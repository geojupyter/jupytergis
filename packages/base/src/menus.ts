import { Menu } from '@lumino/widgets';
import { CommandRegistry } from '@lumino/commands';

import { CommandIDs } from './constants';
import { rasterIcon } from './icons';

export const vectorSubMenu = (commands: CommandRegistry) => {
  const subMenu = new Menu({ commands });

  subMenu.title.label = 'Add Vector Layer';
  subMenu.title.iconClass = 'fa fa-vector-square';
  subMenu.id = 'jp-gis-toolbar-vector-menu';

  subMenu.addItem({
    type: 'command',
    command: CommandIDs.newVectorTileEntry
  });

  subMenu.addItem({
    type: 'command',
    command: CommandIDs.newGeoJSONEntry
  });

  subMenu.addItem({
    type: 'command',
    command: CommandIDs.newShapefileLayer
  });

  return subMenu;
}

export const rasterSubMenu = (commands: CommandRegistry) => {
  const subMenu = new Menu({ commands });

  subMenu.title.label = 'Add Raster Layer';
  subMenu.title.icon = rasterIcon;
  subMenu.id = 'jp-gis-toolbar-raster-menu';

  subMenu.addItem({
    type: 'command',
    command: CommandIDs.newRasterEntry
  });

  subMenu.addItem({
    type: 'command',
    command: CommandIDs.newHillshadeEntry
  });

  subMenu.addItem({
    type: 'command',
    command: CommandIDs.newImageEntry
  });

  subMenu.addItem({
    type: 'command',
    command: CommandIDs.newGeoTiffEntry
  });

  return subMenu;
}
