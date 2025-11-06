import { Button } from '@jupyter/react-components';
import React from 'react';

import {
  BaseForm,
  IBaseFormProps,
} from '@/src/formbuilder/objectform/baseform';

interface IStoryFormProps extends IBaseFormProps {
  togglePreview: () => void;
}

export class StoryEditorForm extends BaseForm {
  props: IStoryFormProps;

  constructor(props: IStoryFormProps) {
    super(props);
  }

  render(): React.ReactNode {
    return (
      <>
        <BaseForm
          formContext="update"
          sourceData={this.props.sourceData}
          model={this.props.model}
          schema={this.props.schema}
          syncData={this.props.syncData}
          filePath={this.props.model.filePath}
        />
        <Button onClick={this.props.togglePreview}>Preview</Button>
      </>
    );
  }
}
