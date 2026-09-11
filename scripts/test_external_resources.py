#!/usr/bin/env python3
"""
Pytest-based external resource checker for JupyterGIS.

This module provides pytest tests to check external resources in .jGIS files
and layer gallery JSON for availability.
"""

import json
import os
import sys
import requests
from pathlib import Path
from typing import List, Dict, Optional
from urllib.parse import urlparse
import pytest
import warnings


class ResourceCheckError(Exception):
    """Exception for resource check failures."""
    pass


def substitute_tile_parameters(url: str, custom_params: Dict = None, max_zoom: float = None) -> str:
    """
    Substitute common tile URL parameters with test values.
    
    Uses custom parameters from the source if available, otherwise falls back to defaults.
    Returns the original URL if no known parameters are found.
    """
    # Default substitutions
    substitutions = {
        '{z}': '8',       # Zoom level 8 - good balance (not too detailed, not too coarse)
        '{x}': '100',     # Tile X coordinate at zoom 8
        '{y}': '100',     # Tile Y coordinate at zoom 8
        '{time}': '2023-01-01',  # Time parameter for temporal layers
        '{variant}': 'default',  # Variant parameter
        '{tilematrixset}': 'GoogleMapsCompatible',  # Common tile matrix set
        '{max_zoom}': '19',  # Maximum zoom
        '{format}': 'png',  # Image format
        '{style}': 'default',  # Style parameter
        '{scale}': '1',    # Scale factor
        '{srs}': 'EPSG:3857',  # Common spatial reference system
        '{layer}': 'default',   # Layer name
        '{s}': 'a'         # Subdomain for load balancing (a, b, c, etc.)
    }
    
    # Use appropriate zoom level if max_zoom is provided
    if max_zoom is not None and max_zoom <= 9:
        # For services with limited zoom (like NASA GIBS), use a lower zoom level
        substitutions['{z}'] = '5'  # Lower zoom level for limited services
        substitutions['{x}'] = '9'   # Corresponding tile coordinates
        substitutions['{y}'] = '15'
        substitutions['{max_zoom}'] = str(int(max_zoom))

    
    # Override with custom parameters if provided
    if custom_params:
        for key, value in custom_params.items():
            # Convert the key to a template format (e.g., 'variant' -> '{variant}')
            template_key = '{' + key + '}'
            if template_key in substitutions:
                substitutions[template_key] = str(value)
    
    result = url
    for template, value in substitutions.items():
        result = result.replace(template, value)
    
    return result


def check_cors_headers(response: requests.Response) -> Dict:
    """Check response headers for potential CORS issues."""
    result = {}
    
    # Check if CORS headers are present
    cors_headers_present = any(header in response.headers for header in 
                               ['access-control-allow-origin', 'access-control-allow-methods'])
    
    if not cors_headers_present:
        result['potential_cors_issue'] = "No CORS headers detected - may have issues in JupyterLite"
    else:
        # Check if the CORS headers are restrictive
        if 'access-control-allow-origin' in response.headers:
            acao = response.headers['access-control-allow-origin']
            if acao not in ['*', 'null'] and not acao.startswith('http'):
                result['potential_cors_issue'] = f"Restrictive CORS origin: {acao}"
    
    return result


def check_url(url: str, url_info: Optional[Dict] = None, timeout: int = 10, is_capabilities_request: bool = False) -> Dict:
    """
    Check if a URL is accessible.
    
    Returns a dict with check results including warnings and errors.
    """
    result = {
        'url': url,
        'success': False,
        'status_code': None,
        'error_type': None,
        'error_detail': None,
        'warning': None
    }
    
    try:
        # Parse URL to validate format
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            result.update({
                'error_type': "invalid_url", 
                'error_detail': "URL is missing scheme or domain"
            })
            return result
        
        # Check if URL contains template parameters (like {z}/{x}/{y})
        if '{' in parsed.path or '{' in parsed.netloc:
            # Try to substitute reasonable default values for common tile parameters
            # Use custom parameters and max_zoom from the source if available
            custom_params = url_info.get('url_params') if url_info else None
            max_zoom = url_info.get('max_zoom') if url_info else None
            test_url = substitute_tile_parameters(url, custom_params, max_zoom)
            if test_url != url:  # If substitution was successful
                return check_url(test_url, url_info, timeout)  # Recursively check with substituted URL
            else:
                result.update({
                    'error_type': "untestable_url",
                    'error_detail': "URL contains unsupported template parameters - cannot check actual endpoint"
                })
                return result
        
        # Special handling for WMS services (skip if this is already a GetCapabilities request)
        if not is_capabilities_request:
            is_wms = False
            if "wms" in parsed.path.lower():
                is_wms = True
            elif parsed.query and "service=wms" in parsed.query.lower():
                is_wms = True
            elif url_info and url_info.get('type') == 'WmsTileSource':
                is_wms = True
            
            if is_wms:
                # Build GetCapabilities request with proper parameters
                separator = '&' if parsed.query else '?'
                wms_params = ""
                
                # Include WMS parameters from the source if available
                if url_info and url_info.get('wms_params'):
                    for key, value in url_info['wms_params'].items():
                        wms_params += f"&{key}={value}"
                
                test_url = f"{url}{separator}service=WMS&request=GetCapabilities&version=1.3.0{wms_params}"
                # Mark this as a GetCapabilities request to avoid recursion
                parsed_test = urlparse(test_url)
                if 'request=GetCapabilities' in parsed_test.query:
                    # This is already a GetCapabilities request, just check it directly
                    return check_url(test_url, None, timeout, is_capabilities_request=True)
                else:
                    return check_url(test_url, None, timeout)  # Don't pass url_info recursively to avoid infinite loop
        
        # Set up session with reasonable defaults
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (compatible; JupyterGIS-Resource-Checker/1.0)',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
            'Sec-Fetch-Dest': 'image',
            'Sec-Fetch-Mode': 'no-cors',
            'Sec-Fetch-Site': 'cross-site'
        })
        
        warnings = []
        
        # Try HEAD request first (faster, less bandwidth)
        try:
            response = session.head(
                url,
                timeout=timeout,
                allow_redirects=True
            )
            
            # Check for successful response
            if response.status_code < 400:
                # Check for CORS-related headers even in HEAD response
                cors_headers = check_cors_headers(response)
                if cors_headers.get('potential_cors_issue'):
                    warnings.append(cors_headers['potential_cors_issue'])
                
                result.update({
                    'success': True,
                    'status_code': response.status_code,
                    'warning': "; ".join(warnings) if warnings else None
                })
                return result
            elif response.status_code == 405:  # Method Not Allowed
                # Fall back to GET
                response = session.get(
                    url,
                    timeout=timeout,
                    allow_redirects=True,
                    stream=True  # Don't download full content
                )
                if response.status_code < 400:
                    # Check CORS headers on GET response
                    cors_headers = check_cors_headers(response)
                    if cors_headers.get('potential_cors_issue'):
                        warnings.append(cors_headers['potential_cors_issue'])
                    
                    result.update({
                        'success': True,
                        'status_code': response.status_code,
                        'warning': "; ".join(warnings) if warnings else None
                    })
                    return result
            
            # Handle specific error codes
            if response.status_code == 403:
                warnings.append("403 Forbidden - may have CORS issues in JupyterLite")
            elif response.status_code == 404:
                result.update({
                    'error_type': "not_found",
                    'status_code': response.status_code
                })
                return result
            elif response.status_code == 429:
                warnings.append("429 Too Many Requests - rate limiting may occur")
            elif response.status_code >= 500:
                result.update({
                    'error_type': "server_error",
                    'status_code': response.status_code
                })
                return result
            
            result.update({
                'status_code': response.status_code,
                'warning': "; ".join(warnings) if warnings else None
            })
            return result
            
        except requests.exceptions.SSLError as e:
            result.update({
                'error_type': "ssl_error",
                'error_detail': str(e)
            })
            return result
        except requests.exceptions.Timeout:
            result.update({
                'error_type': "timeout",
                'error_detail': f"Timeout after {timeout} seconds"
            })
            return result
        except requests.exceptions.TooManyRedirects:
            result.update({
                'error_type': "redirect_loop",
                'error_detail': "Too many redirects"
            })
            return result
        except requests.exceptions.ConnectionError as e:
            if "CERTIFICATE_VERIFY_FAILED" in str(e):
                result.update({
                    'error_type': "ssl_error",
                    'error_detail': str(e)
                })
            else:
                result.update({
                    'error_type': "connection_error",
                    'error_detail': str(e)
                })
            return result
        except requests.exceptions.RequestException as e:
            result.update({
                'error_type': "request_error",
                'error_detail': str(e)
            })
            return result
    
    except Exception as e:
        result.update({
            'error_type': "unexpected_error",
            'error_detail': str(e)
        })
        return result


def extract_urls_from_jgis_file(filepath: Path) -> List[Dict]:
    """Extract URLs from a .jGIS file with their context."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        urls = []
        
        # Check sources section
        if 'sources' in data and isinstance(data['sources'], dict):
            for source_id, source_data in data['sources'].items():
                if isinstance(source_data, dict) and 'parameters' in source_data:
                    params = source_data['parameters']
                    if 'url' in params and isinstance(params['url'], str):
                        url_info = {'url': params['url'], 'type': source_data.get('type')}
                        # Include URL parameters if present
                        if 'urlParameters' in params and isinstance(params['urlParameters'], dict):
                            url_info['url_params'] = params['urlParameters']
                        # Include maxZoom if present (for choosing appropriate test zoom level)
                        if 'maxZoom' in params:
                            url_info['max_zoom'] = params['maxZoom']
                        # Include WMS parameters if present
                        if source_data.get('type') == 'WmsTileSource' and 'params' in params:
                            url_info['wms_params'] = params['params']
                        urls.append(url_info)
        
        # Check layers section for direct URLs
        if 'layers' in data and isinstance(data['layers'], dict):
            for layer_id, layer_data in data['layers'].items():
                if isinstance(layer_data, dict) and 'parameters' in layer_data:
                    params = layer_data['parameters']
                    if 'url' in params and isinstance(params['url'], str):
                        urls.append({'url': params['url']})
        
        return urls
    except Exception as e:
        print(f"Warning: Could not parse {filepath}: {e}", file=sys.stderr)
        return []


def extract_urls_from_layer_gallery(filepath: Path) -> List[Dict]:
    """Extract URLs from layer gallery JSON file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        urls = []
        
        def traverse_gallerysection(section):
            """Recursively traverse gallery sections."""
            if isinstance(section, dict):
                # Check for sourceParameters with URLs
                if 'sourceParameters' in section and isinstance(section['sourceParameters'], dict):
                    source_params = section['sourceParameters']
                    if 'url' in source_params:
                        url_info = {'url': source_params['url']}
                        
                        # Extract URL parameters if available
                        if 'urlParameters' in source_params and isinstance(source_params['urlParameters'], dict):
                            url_info['url_params'] = source_params['urlParameters']
                        
                        # Extract maxZoom if available
                        if 'maxZoom' in source_params:
                            url_info['max_zoom'] = source_params['maxZoom']
                        
                        urls.append(url_info)
                
                # Recurse into subsections
                for value in section.values():
                    if isinstance(value, dict):
                        traverse_gallerysection(value)
                    elif isinstance(value, list):
                        for item in value:
                            if isinstance(item, dict):
                                traverse_gallerysection(item)
            
        traverse_gallerysection(data)
        return urls
    except Exception as e:
        print(f"Warning: Could not parse {filepath}: {e}", file=sys.stderr)
        return []


@pytest.mark.resource_check
class TestExternalResources:
    """Pytest tests for external resources."""
    
    @pytest.mark.parametrize("filepath", [
        "examples/pmtiles-raster.jGIS",
        "examples/wms-tile.jGIS",
        "examples/france_hiking.jGIS",
        "packages/base/_generated/layer_gallery.json"
    ])
    def test_external_resources_in_file(self, filepath: str):
        """Test all external resources in a specific file."""
        path = Path(filepath)
        if not path.exists():
            pytest.skip(f"File {filepath} does not exist")
        
        if path.name.endswith('.jGIS'):
            urls = extract_urls_from_jgis_file(path)
        elif path.name == 'layer_gallery.json':
            urls = extract_urls_from_layer_gallery(path)
        else:
            pytest.skip(f"File {filepath} is not a recognized type")
        
        if not urls:
            pytest.skip(f"No URLs found in {filepath}")
        
        # Test each URL
        for url_info in urls:
            url = url_info['url']
            result = check_url(url, url_info)
            
            # Report warnings but don't fail
            if result.get('warning'):
                warnings.warn(f"URL warning: {url} - {result['warning']}", UserWarning)
            
            # Fail on errors
            if not result['success']:
                error_msg = f"URL check failed: {url}"
                if result.get('error_type'):
                    error_msg += f" ({result['error_type']})"
                if result.get('error_detail'):
                    error_msg += f": {result['error_detail']}"
                if result.get('status_code'):
                    error_msg += f" (HTTP {result['status_code']})"
                
                # Use pytest.fail to get nice error reporting
                pytest.fail(error_msg)


def test_all_examples():
    """Test all .jGIS files in examples directory."""
    examples_dir = Path("examples")
    if not examples_dir.exists():
        pytest.skip("Examples directory does not exist")
    
    failed_urls = []
    warning_urls = []
    
    for jgis_file in examples_dir.glob("*.jGIS"):
        urls = extract_urls_from_jgis_file(jgis_file)
        
        for url_info in urls:
            url = url_info['url']
            result = check_url(url, url_info)
            
            if result.get('warning'):
                warning_urls.append((str(jgis_file), url, result['warning']))
            
            if not result['success']:
                failed_urls.append((str(jgis_file), url, result))
    
    # Report warnings
    for file_path, url, warning in warning_urls:
        warnings.warn(f"{file_path}: {url} - {warning}", UserWarning)
    
    # Fail if any URLs failed
    if failed_urls:
        error_messages = []
        for file_path, url, result in failed_urls:
            error_msg = f"{file_path}: {url}"
            if result.get('error_type'):
                error_msg += f" ({result['error_type']})"
            if result.get('error_detail'):
                error_msg += f": {result['error_detail']}"
            if result.get('status_code'):
                error_msg += f" (HTTP {result['status_code']})"
            error_messages.append(error_msg)
        
        pytest.fail("\n".join(error_messages))


def test_layer_gallery():
    """Test all URLs in layer gallery."""
    gallery_file = Path("packages/base/_generated/layer_gallery.json")
    if not gallery_file.exists():
        pytest.skip("Layer gallery file does not exist")
    
    urls = extract_urls_from_layer_gallery(gallery_file)
    
    if not urls:
        pytest.skip("No URLs found in layer gallery")
    
    failed_urls = []
    warning_urls = []
    
    for url_info in urls:
        url = url_info if isinstance(url_info, str) else url_info['url']
        url_info_dict = url_info if isinstance(url_info, dict) else None
        result = check_url(url, url_info_dict)
        
        if result.get('warning'):
            warning_urls.append((url, result['warning']))
        
        if not result['success']:
            failed_urls.append((url, result))
    
    # Report warnings
    for url, warning in warning_urls:
        warnings.warn(f"{url} - {warning}", UserWarning)
    
    # Fail if any URLs failed
    if failed_urls:
        error_messages = []
        for url, result in failed_urls:
            error_msg = f"{url}"
            if result.get('error_type'):
                error_msg += f" ({result['error_type']})"
            if result.get('error_detail'):
                error_msg += f": {result['error_detail']}"
            if result.get('status_code'):
                error_msg += f" (HTTP {result['status_code']})"
            error_messages.append(error_msg)
        
        pytest.fail("\n".join(error_messages))


if __name__ == "__main__":
    # Allow running as standalone script
    pytest.main([__file__, "-v", "--tb=short"])