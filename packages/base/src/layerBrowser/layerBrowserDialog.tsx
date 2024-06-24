import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ReactWidget } from '@jupyterlab/ui-components';

import React, { useEffect, useState } from 'react';

const temp = [
  {
    name: 'bathy',
    description: 'ocean coloring',
    // thumbnail: HTMLImageElement;
    // source: IRasterSource;
    url: 'https://library-thumbnails.felt.com/Bathymetry-q80.jpg'
  },
  {
    name: 'bicylce',
    description: 'bike lanes',
    url: 'https://library-thumbnails.felt.com/Bicycle%20Lanes-q80.jpg'
    // thumbnail: HTMLImageElement;
    // source: IRasterSource;
  },
  {
    name: 'bathyksdbfjkbsdjkfbksdbfksdfkjgsdjkfbjksdfuijsdghfkjbsdkfuoehrfjlkdnfkjnsdbfjksdhfjksdbkf',
    description: 'ocean coloring',
    // thumbnail: HTMLImageElement;
    // source: IRasterSource;
    url: 'https://library-thumbnails.felt.com/Bathymetry-q80.jpg'
  },
  {
    name: 'bicylce',
    description:
      'bike laneslkas dnfjkwesh ofhweiop fhiowenflmwe sdnfoiw ehfiopwe joh bwesojfhweokhfesdjbfjsd rfjkwesdiojfhwesoj fwoef oiwehfioweshfownef weihfoiwe fewoif oweihfo ',
    url: 'https://library-thumbnails.felt.com/Bicycle%20Lanes-q80.jpg'
    // thumbnail: HTMLImageElement;
    // source: IRasterSource;
  },
  {
    name: 'bathy',
    description: 'ocean coloring',
    // thumbnail: HTMLImageElement;
    // source: IRasterSource;
    url: 'https://library-thumbnails.felt.com/Bathymetry-q80.jpg'
  },
  {
    name: 'bicylce',
    description: 'bike lanes',
    url: 'https://library-thumbnails.felt.com/Bicycle%20Lanes-q80.jpg'
    // thumbnail: HTMLImageElement;
    // source: IRasterSource;
  }
];

//TODO take the browser options as prop? or pull from somewhere else
const LayerBrowserComponent = () => {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const dialog = document.getElementsByClassName('jp-Dialog-content');

    dialog[0].classList.add('jgis-dialog-override');
  }, []);

  const handleChange = event => {
    setSearchTerm(event.target.value.toLowerCase());
  };

  const filteredItems = temp.filter(item =>
    item.name.toLowerCase().includes(searchTerm)
  );

  return (
    <div className="jgis-layer-browser-container">
      <div className="jgis-layer-browser-header">
        <h2 className="jgis-layer-browser-text-general jgis-layer-browser-header-text">
          Layer Browser
        </h2>
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={handleChange}
          className="jgis-layer-browser-header-search"
        />
      </div>
      <div className="jgis-layer-browser-grid">
        {filteredItems.map(tile => (
          <div className="jgis-layer-browser-tile">
            <div className="jgis-layer-browser-tile-img-container">
              <img className="jgis-layer-browser-img" src={tile.url} />
              <div className="jgis-layer-browser-icon">
                <FontAwesomeIcon style={{ height: 20 }} icon={faPlus} />
              </div>
            </div>
            <div className="jgis-layer-browser-text-container">
              <div className="jgis-layer-browser-text-info">
                <h3 className="jgis-layer-browser-text-header jgis-layer-browser-text-general">
                  {tile.name}
                </h3>
                <p className="jgis-layer-browser-text-general jgis-layer-browser-text-description">
                  {tile.description}
                </p>
              </div>
              <p className="jgis-layer-browser-text-general jgis-layer-browser-text-source">
                Global * Source * date
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export class LayerBrowserWidget extends ReactWidget {
  constructor() {
    super();
  }

  render() {
    return <LayerBrowserComponent />;
  }
}
