import { faLink } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import jgisSchema from '@jupytergis/schema/lib/schema/project/jgis.json';
import { CommandRegistry } from '@lumino/commands';
import React, { useMemo } from 'react';

import { CommandIDs } from '@/src/constants';
import { StoryEditorPropertiesForm } from '@/src/formbuilder/objectform/StoryEditorForm';
import { Button } from '@/src/shared/components/Button';
import { deepCopy } from '@/src/tools';
import { IDict } from '@/src/types';

interface IStoryPanelProps {
  model: IJupyterGISModel;
  commands: CommandRegistry;
}

const storyMapSchema: IDict = deepCopy(jgisSchema.definitions.jGISStoryMap);

const AddStorySegmentButton = ({ model, commands }: IStoryPanelProps) => (
  <Button onClick={() => commands.execute(CommandIDs.addStorySegment)}>
    <FontAwesomeIcon icon={faLink} /> Add Story Segment
  </Button>
);

export function StoryEditorPanel({ model, commands }: IStoryPanelProps) {
  const { storySegmentId, story } = useMemo(() => {
    return model.getSelectedStory();
  }, [model, model.sharedModel.stories]);

  const syncStoryData = (properties: IDict) => {
    model.sharedModel.updateStoryMap(
      storySegmentId,
      properties as IJGISStoryMap,
    );
  };

  if (!story) {
    return (
      <div>
        <p>No Story Map available.</p>
        <p>
          Add a Story Segment from the Add Layer menu. A segment captures the
          current map view. You can add markdown text and an image to each
          segment to tell your story.
        </p>
        <AddStorySegmentButton model={model} commands={commands} />
      </div>
    );
  }

  return (
    <div className="jgis-story-editor-panel">
      <StoryEditorPropertiesForm
        formContext="update"
        sourceData={story}
        model={model}
        schema={storyMapSchema}
        syncData={syncStoryData}
        filePath={model.filePath}
      />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <AddStorySegmentButton model={model} commands={commands} />
      </div>
    </div>
  );
}

export default StoryEditorPanel;
