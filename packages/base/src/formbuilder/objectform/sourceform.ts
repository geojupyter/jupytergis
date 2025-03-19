import { IBaseFormProps } from './baseform';
import { SourceType } from '@jupytergis/schema';

export interface ISourceFormProps extends IBaseFormProps {
  sourceType: SourceType;
}
