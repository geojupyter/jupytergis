import { CommandRegistry } from '@lumino/commands';
import { Menu } from '@lumino/widgets';

import { CommandIDs } from './constants';
import { rasterIcon } from './icons';

export const vectorSubMenu = (commands: CommandRegistry) => {
  const subMenu = new Menu({ commands });

  subMenu.title.label = 'Add Vector Layer';
  subMenu.title.iconClass = 'fa fa-vector-square';
  subMenu.id = 'jp-gis-toolbar-vector-menu';

  subMenu.addItem({
    type: 'command',
    command: CommandIDs.openNewVectorTileDialog,
  });

  subMenu.addItem({
    type: 'command',
    command: CommandIDs.openNewGeoJSONDialog,
  });

  subMenu.addItem({
    type: 'command',
    command: CommandIDs.openNewShapefileDialog,
  });

  subMenu.addItem({
    type: 'command',
    command: CommandIDs.openNewGeoParquetDialog,
  });

  return subMenu;
};

export const rasterSubMenu = (commands: CommandRegistry) => {
  const subMenu = new Menu({ commands });

  subMenu.title.label = 'Add Raster Layer';
  subMenu.title.icon = rasterIcon;
  subMenu.id = 'jp-gis-toolbar-raster-menu';

  subMenu.addItem({
    type: 'command',
    command: CommandIDs.openNewRasterDialog,
  });

  subMenu.addItem({
    type: 'command',
    command: CommandIDs.openNewHillshadeDialog,
  });

  subMenu.addItem({
    type: 'command',
    command: CommandIDs.openNewImageDialog,
  });

  subMenu.addItem({
    type: 'command',
    command: CommandIDs.openNewGeoTiffDialog,
  });

  return subMenu;
};
