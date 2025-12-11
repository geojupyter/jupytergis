import { faLink } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IJGISStoryMap, IJupyterGISModel } from '@jupytergis/schema';
import jgisSchema from '@jupytergis/schema/lib/schema/project/jgis.json';
import React, { useMemo } from 'react';

import { StoryEditorPropertiesForm } from '@/src/formbuilder/objectform/StoryEditorForm';
import { Button } from '@/src/shared/components/Button';
import { deepCopy } from '@/src/tools';
import { IDict } from '@/src/types';

interface IStoryPanelProps {
  model: IJupyterGISModel;
}

const storyMapSchema: IDict = deepCopy(jgisSchema.definitions.jGISStoryMap);

const AddStorySegmentButton = ({ model }: IStoryPanelProps) => (
  <Button onClick={() => model.addStorySegment()}>
    <FontAwesomeIcon icon={faLink} /> Add Story Segment
  </Button>
);

export function StoryEditorPanel({ model }: IStoryPanelProps) {
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
        <AddStorySegmentButton model={model} />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0.5rem 0.5rem 0.5rem' }}>
      <StoryEditorPropertiesForm
        formContext="update"
        sourceData={story}
        model={model}
        schema={storyMapSchema}
        syncData={syncStoryData}
        filePath={model.filePath}
      />
      <AddStorySegmentButton model={model} />
    </div>
  );
}

export default StoryEditorPanel;
