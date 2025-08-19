
!!! question	inline end "Have a term to add?"

	 **[Create an issue on GitHub!](https://github.com/geo4lib/geo4libcamp-website/issues)**


*terms, phrases, acronyms, & jargon commonly used in association with spatial data, GIS and Open Source development*


## API

Application Programming Interface. Broadly defined, an API is how different software applications can talk to each other and share information. In library practice, this usually takes the format of a JSON file URL that can be accessed by a script for harvesting data, metadata, or schema information.

## Attribute Table

A tabular file or database of the information associated with features or cells in a spatial dataset.

## Bounding box

A bounding box delineates the geographic extent of a given spatial dataset and is typically conceived as the smallest hypothetical rectangle that would fully enclose the features of a spatial dataset. It is defined by four coordinates: the hypothetical rectangle's minimum longitude, minimum latitude, maximum longitude, and maximum latitude. These coordinates correspond, respectively, with the hypothetical rectangle's leftmost line, its bottom, its rightmost line, and its top. A dataset's bounding box is an important component of geospatial metadata. Note that it is often also referred to as an envelope. https://wiki.openstreetmap.org/Bounding_Box

## CKAN (Comprehensive Knowledge Archive Network)

An open-source data platform that can be used for geospatial data. https://ckan.org/

## Cloud Optimized GeoTiffs

A Cloud Optimized GeoTiff (COG) is a regular GeoTIFFs that is internally organized so that it can be hosted and accessed on an HTTP server, meaning users can work with specific portions of images they request https://www.cogeo.org/

## Controlled vocabulary and authorities

Controlled vocabularies are standardized and organized arrangements of words and phrases and provide a consistent way to describe data. Metadata creators assign terms from vocabularies to improve information retrieval. Geospatial controlled vocabulary example: ISO 19115 Topic Categories

Authority records are a type of controlled vocabulary that exists in an index (called an authority file) for the purpose of controlling headings used in a catalog or repository. This process is called authority control. Example: the Library of Congress Name Authority File \ https://guides.lib.utexas.edu/metadata-basics/controlled-vocab

## Coverage

A deprecated proprietary format from Esri that can store multiple spatial geometries, topologies, and attributes.

## Data Licenses

Legal statements defining permissions and sharing. https://creativecommons.org/licenses/by/4.0/ https://opendatacommons.org/

## Data Rights

These statements refer to access and usage specifications for datasets https://rightsstatements.org/page/1.0

## Data vs. Metadata

Data is the content you are measuring, collecting, etc. Metadata means data about data, which refers to the information about the content, e.g., who collected it plus where, why, when, and how it was collected. Geospatial metadata describes maps, Geographic Information Systems (GIS) files, imagery, and other location-based data resources. https://www.fgdc.gov/metadata

## Dublin Core

A widely used set of key elements designed to be web semantic and interoperable.

## EPSG

A catalog of coordinate system names and parameters originally defined by the European Petroleum Survey Group. Many GIS programs refer to specific coordinate systems by their EPSG number. For example EPSG:32618 refers to WGS 84 / UTM Zone 18N. http://epsg.io/

## Feature extraction

The creation of a GIS feature layer (e.g. shapefile), of features (e.g. points, lines and polygons), from a georeferenced raster file (i.e. scanned map). This process may be manual or automated. Synonyms: vectorization, digitization

## Features and Attributes

A feature represents a spatial location (represented, for instance, by a point, polygon, or line) within a GIS dataset; attributes refer to information associated with a given feature. For example, in a point dataset of public schools, school locations (represented by points) are features; information that is associated with these schools (i.e. student population, student:teacher ratio, year founded, school name etc.) are attributes. https://www.e-education.psu.edu/geog160/node/1930

## FGDC

FGDC CSDGM (Federal Geographic Data Committee Content Standard for Digital Geospatial Metadata) is a metadata standard for GIS vector and raster data developed in the US in the 1990s. Usually referred to simply as FGDC. The preferable format is XML, but FGDC is also stored as TXT or HTML.

## Gazetteer

A gazetteer is a geographic index or dictionary to help identify a geographic location associated with a place name. Traditionally, gazetteers were published in conjunction with physical maps and atlases. Digitally, gazetteers function as interoperable data dictionaries for GIS. An example of a gazetteer is GeoNames. https://guides.library.ucla.edu/maps/gazeteers

## GeoBlacklight

Both an open-source software application and the community supporting it. GeoBlacklight (GBL) is a multi-institutional discovery software application for geospatial content, including GIS data and maps. Based on the software project Blacklight, GeoBlacklight began in 2014 as a collaboration by MIT, Princeton, and Stanford. GeoBlacklight has since been adopted by over 25 academic libraries and cultural heritage institutions. https://geoblacklight.org/

## Geocoding

The process of taking text-based location descriptions (such as mailing address, or placenames) and converting them to explicit geographic information, usually coordinates https://guides.library.illinois.edu/Geocoding

## GeoCombine

A set of tools found in the OpenGeoMetadata GitHub repository that can be used for some batch metadata transformations and harvesting. (mainly for GeoBlacklight)

## Geodatabase

A proprietary ArcGIS file or database format that can hold multiple geometry types, spatial reference, attributes, and behavior for data OR a generic term for a spatial database.

## GeoJSON

GeoJSON is a specific type of JSON for encoding spatial data. As an open standard, it is endorsed by preservation organizations, such as the Library of Congress. However, it can be unwieldy for large datasets, as it is a flat file format, not a database. NOTE: a common misconception is that the GeoBlacklight metadata schema uses GeoJSON. This is incorrect - it uses JSON with a few geospatial-related elements. There is also a TopoJSON that extends geoJSON to include topology. However, TopoJSON is not yet an endorsed standard. https://geojson.org/ https://github.com/topojson

## GeoNames

GeoNames is a database providing standard vocabulary for geographic place names, given in WGS84 coordinates https://www.geonames.org/about.html

## Georectification and Georeferencing

(These words were once slightly different but are now used interchangeably.) The process of relating the internal coordinate system of an image to a ground system of geographic coordinates, so that the image can be used for spatial analysis of points on the Earth's surface. Georeferencing can be accomplished in a variety of software applications, including some that are browser-based, and the images are stored in a variety of formats, but GeoTIFFs and GeoPDFs are the most common. https://www.usgs.gov/faqs/what-does-georeferenced-mean?qt-news_science_products=0glossary/#qt-news_science_products

## Georeferenced scanned map

A special format where a scanned image has a linked file that stores spatial information. This allows the scanned map to be viewed as a layer in a GIS program or on a digital map.

## GeoServer

GeoServer is an open source server written in Java that allows for sharing, processing and editing geospatial data. It is an easy way to connect existing information to platforms that highlight geospatial data such as Leaflet, OpenLayers, virtual globes, and GeoBlacklight. Designed for interoperability, it uses open standards to publish data from spatial data sources. http://geoserver.org/

## Geotag

This term means to add geospatial metadata to media. It is often confused with georeference, but is more specifically considered a metadata attribute. In practice, geotagging typically entails adding one coordinate or point that is used to locate a photo or media object.

## GeoTIFF

a TIFF image file with geospatial information embedded with it.

## IIIF

Spoken as "Triple eye eff" or International Image Interoperability Framework. A standardized technique for sharing images (particularly map scans) on the web. IIIF specifies APIs in the form of JSON files that can be displayed via several different image viewers. https://iiif.io/

## Index map

An index map is a geospatial data discovery tool that allows users to organize, find, and contextualize the individual maps or datasets that constitute a broader collection of geospatial data. It typically delineates the geographic area encompassed by a given collection; individual records that correspond with particular locations are superimposed on this general map, allowing users to effectively browse a collection based on the locations its constituent elements. https://kgjenkins.github.io/openindexmaps-workshop/index-maps

## Ingest

Ingest is similar to accessioning, but is more specifically referring to the process of adding data or metadata into a database or application.

## ISO 19115

A standard from the International Standards Organization developed in the early 2000s intended for many types of geospatial resources. Can include web services and URIs

## ISO 19139

The XML expression of the ISO 19115 standard. It contains identification, constraint, extent, quality, spatial and temporal reference, distribution, lineage, and maintenance of the digital geographic dataset.

## JSON

The JSON file format is an open standard for data exchange. It consists of objects, key:value pairs, and arrays. GeoBlacklight metadata records are expressed as JSON files. Note: JSON can be thought of as a more lightweight alternative to XML files. https://github.com/geoblacklight/geoblacklight/JSON-format

## JSON-LD

This stands for JSON-Linked Data. This open standard is formatted to include specifications for linked data, such as URIs and relationships. There is also a geoJSON-LD format. https://geojson.org/geojson-ld/

## Layer

A map document object that references a dataset (spatial + attribute data) and contains information about how it should be displayed, queried, related to other layers and symbolized within a map

## Leaflet

Leaflet is an open-source JavaScript library that helps developers build webmaps on mobile as well as desktop platforms. https://leafletjs.com/

## Linked Data

Linked Data is the engine of the Semantic Web, a term used by World Wide Web creator Sir Tim Berners-Lee to describe a future Web of Data, wherein the Web will be organized via interlinking, interoperable data instead of collections of pages. Linked data is structured ontologically, with standard vocabularies and unique identifiers, so that it can be queried, added to, and repurposed by any machine or human language. Example: GeoNames has a Linked Data ontology. https://www.w3.org/standards/semanticweb/data ;

http://www.geonames.org/ontology/documentation.html

## Metadata Crosswalk

A set of specifications for transforming metadata elements from one schema to another. This allows for metadata harvesting and record exchanges.

## Metadata Schema

How metadata is structured: the fields and the types of values

## Metadata Standard

To become a metadata standard, a schema needs to be adopted and officially endorsed by a standards-body. https://library.ucsd.edu/lpw-staging/research-and-collections/data-curation/sharing-discovery/describe-your-data/metadata-schemas.html

## OpenGeoMetadata

OpenGeoMetadata is a platform for sharing geospatial metadata files. It is currently structured as a GitHub organization with repositories for each institution. OpenGeoMetadata has been most commonly used for harvesting GeoBlacklight schema metadata files from other institutions [https://opengeometadata.org](https://opengeometadata.org)

## Open-source software

A software application is considered open source if its source code is freely available to users, who can expand, adapt, modify, and distribute this code as they see fit. Open source software is typically developed collaboratively; as a result, it is important to be able to systematically track changes to the codebase, and to track different versions of a project that result from these changes. Git is a version control system that facilitates collaboration on open-source projects (such as the Geoblacklight project) by allowing participants to essentially track changes and follow each others' work. Github is a web platform that allows users to collaborate on open-source projects using the Git version control system. In the context of Github, a pull request is a procedure wherein someone who wishes to make changes to a project's codebase requests a member of the project team to review these proposed changes; if the reviewer approves these changes, they become incorporated (or merged) into the main codebase.

## OpenIndexMaps

OpenIndexMaps is a specific index map standard (encoded in GeoJSON format), that is used by the GeoBlacklight community. https://kgjenkins.github.io/openindexmaps-workshop/openindexmaps

## PostGIS and PostGreSQL

Postgres, also known as PostgreSQL, is a free and open-source object-relational database management system (RDBMS). Its purpose is to manage data, no matter whether datasets are large or small, in an extensible environment where developers can customize its functionality with data types, functions, etc. PostGIS is an extension of PostgreSQL that adds support for geographic objects. https://www.postgresql.org/ and https://postgis.net/

## Projections

In order to make a map, one has to represent the three-dimensional surface of the earth on a two-dimensional plane. There are different ways in which one might flatten the earth to represent it on a two-dimensional map, and these different flattening algorithms (all of which involve distortions of one kind or another) are referred to as map projections. Most maps published on the web are in the Web Mercator projection. Related terms: CRS (coordinate reference system) or the older term SRS (spatial reference system) https://www.gislounge.com/map-projection/

## Pull requests

Part of a development workflow when someone wants to merge changes. Read more at the following links:

* [https://blog.axosoft.com/learning-git-pull-request/](https://blog.axosoft.com/learning-git-pull-request/)
* [https://www.digitalocean.com/community/tutorials/how-to-create-a-pull-request-on-github; On Git and Github](https://www.digitalocean.com/community/tutorials/how-to-create-a-pull-request-on-github; On Git and Github)
* [https://techcrunch.com/2012/07/14/what-exactly-is-github-anyway/](https://techcrunch.com/2012/07/14/what-exactly-is-github-anyway/)

## Raster

A type of spatial data that uses geographically referenced grid cells/pixels, which are associated with data on attributes of interest (i.e. temperature, elevation, population etc.), to represent real-world phenomena.

## Raster Dataset

A raster format used in ArcGIS Geodatabases OR a generic term for a raster file.

## Research, licensed, and open data

Research data refers to data that has been collected and compiled by researchers affiliated with a given institution (and often released in conjunction with a publication or journal article). Licensed data is data (or a particular interface to data) that an institution (i.e. an academic library) purchases for use by its affiliates. Openly available data (for instance, municipal data) is data that was neither purchased by an institution nor created by its researchers, but which is freely available to the public, and therefore often ingested or indexed by academic libraries to facilitate discovery and preservation.

## Shapefile

An open source geospatial vector data format containing a small bundle of files. Note: the mostly open specification, only covers the .shp, .shx, and .dbf components (notably, .prj is not specified!) https://www.esri.com/library/whitepapers/pdfs/shapefile.pdf

## Solr

Solr, or Apache Solr, is an open-source enterprise search platform writtin in Java. It runs as a standalone full-text server with faceted search, real-time indexing, dynamic clustering and database integration capabilities. It has a configuration that allows for connection to many applications without Java coding and architecture for further customization. It is the indexing system that sits under Blacklight. https://lucene.apache.org/solr/

## Source

Usually refers to the path on a file system, URL or other reference to the data file that a layer refers to

## Spatial data infrastructure components

A spatial data infrastructure (SDI) is a digital apparatus (comprised of interconnected applications and repositories) that facilitates geospatial data storage, discovery, and long-term preservation. Geoblacklight is an application that allows users to discover geospatial data, access relevant metadata, preview layers, and download GIS datasets. Geoserver is an open-source server that allows for GIS data sharing; more specifically, in the context of the Geoblacklight application, it facilitates layer previews and downloads. Institutions that use Geoblacklight as a spatial data discovery platform typically also preserve these underlying datasets in the context of an institutional repository, as well as share relevant metadata through OpenGeoMetadata (a metadata repository that allows institutions to index geospatial data owned by other institutions, and hence data discoverable on their local Geoblacklight instances). There are many moving parts in a spatial data infrastructure; for a more detailed explication of these parts and how they fit together, see the narrative description authored by NYU Data Services. https://andrewbattista.github.io/geoblacklight/2018/01/09/geoblacklight-overview.html

## tippecanoe

This tool builds vector tilesets from large collections of GeoJSON features.
https://github.com/mapbox/tippecanoe

## Un-georeferenced scanned map

A scanned map stored as an image file, such as TIFF or JPEG. The presence of coordinates in the record’s metadata does not make the map georeferenced.

## Unconference

Unconferences are intended to be led by participants, with discussion topics developed collaboratively at the start of the event. Unconferences feature minimal formal presentations and emphasize group discussions, knowledge sharing, and impromptu demonstrations. Geo4LibCamp is an unconference. https://en.wikipedia.org/wiki/Unconference

## Vector

A type of spatial data that uses geocoded points, lines (connected points), and polygons (an enclosed shape defined by connected lines) to represent real-world phenomena.

## Web services

Web services are specific types of APIs used for sharing data. These are especially useful for geospatial data, which cannot be rendered in browsers in their native formats. They are also helpful for users who do not have access to GIS desktop software.

## WFS

The Web Feature Service (WFS) standard is a Web protocol from the Open Geospatial Consortium (OGC) that serves geographical feature queries over HTTP connections that can be spatially analyzed. It is used by major open-source and proprietary mapping software https://www.ogc.org/standards/wfs

## WGS 84

WGS 84 is shorthand for World Geodetic System 1984, the common latitude/longitude coordinate system use by GPS devices and many datasets

## Who’s on First

A gazetteer for linked data created by Mapzen. (No longer actively developed) https://whosonfirst.org/

## WMS

The Web Map Service (WMS) standard is a Web protocol from the Open Geospatial Consortium (OGC) that serves geospatial images over HTTP connections. It is used by major open-source and proprietary mapping software https://www.ogc.org/standards/wms
