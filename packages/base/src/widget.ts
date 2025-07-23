import {
  IAnnotationModel,
  IJGISFormSchemaRegistry,
  IJupyterGISDocumentWidget,
  IJupyterGISModel,
  IJupyterGISOutputWidget,
} from '@jupytergis/schema';
import { MainAreaWidget } from '@jupyterlab/apputils';
import { ConsolePanel, IConsoleTracker } from '@jupyterlab/console';
import { DocumentWidget } from '@jupyterlab/docregistry';
import { IObservableMap, ObservableMap } from '@jupyterlab/observables';
import { IStateDB } from '@jupyterlab/statedb';
import { CommandRegistry } from '@lumino/commands';
import { JSONValue } from '@lumino/coreutils';
import { MessageLoop } from '@lumino/messaging';
import { ISignal, Signal } from '@lumino/signaling';
import { SplitPanel, Widget } from '@lumino/widgets';

import { ConsoleView } from './console';
import { JupyterGISMainViewPanel } from './mainview';
import { MainViewModel } from './mainview/mainviewmodel';

const CELL_OUTPUT_WIDGET_CLASS = 'jgis-cell-output-widget';

export type JupyterGISWidget =
  | JupyterGISDocumentWidget
  | JupyterGISOutputWidget;

export class JupyterGISDocumentWidget
  extends DocumentWidget<JupyterGISPanel, IJupyterGISModel>
  implements IJupyterGISDocumentWidget
{
  constructor(
    options: DocumentWidget.IOptions<JupyterGISPanel, IJupyterGISModel>,
  ) {
    super(options);
  }

  get model(): IJupyterGISModel {
    return this.context.model;
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    this.content.dispose();
    super.dispose();
  }

  onResize = (msg: any): void => {
    window.dispatchEvent(new Event('resize'));
  };
}

/**
 * A main area widget designed to be used as Notebook cell output widget, to ease the
 * integration of toolbar and tracking.
 */
export class JupyterGISOutputWidget
  extends MainAreaWidget<JupyterGISPanel>
  implements IJupyterGISOutputWidget
{
  constructor(options: JupyterGISOutputWidget.IOptions) {
    super(options);
    this.addClass(CELL_OUTPUT_WIDGET_CLASS);
    this.model = options.model;

    this.resizeObserver = new ResizeObserver(() => {
      // Send a resize message to the widget, to update the child size.
      MessageLoop.sendMessage(this, Widget.ResizeMessage.UnknownSize);
    });
    this.resizeObserver.observe(this.node);

    this.model.disposed.connect(() => this.dispose());
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    if (!this.isDisposed) {
      this.resizeObserver.disconnect();
      this.content.dispose();
      super.dispose();
    }
  }

  readonly model: IJupyterGISModel;
  readonly resizeObserver: ResizeObserver;
}

export namespace JupyterGISOutputWidget {
  export interface IOptions extends MainAreaWidget.IOptions<JupyterGISPanel> {
    model: IJupyterGISModel;
  }
}

export class JupyterGISPanel extends SplitPanel {
  constructor({
    model,
    consoleTracker,
    state,
    commandRegistry,
    formSchemaRegistry,
    annotationModel,
    ...consoleOption
  }: JupyterGISPanel.IOptions) {
    super({ orientation: 'vertical', spacing: 0 });

    this._state = state;
    this._initModel({ model, commandRegistry });
    this._initView(formSchemaRegistry, annotationModel);
    this._consoleOption = { commandRegistry, ...consoleOption };
    this._consoleTracker = consoleTracker;
  }

  _initModel(options: {
    model: IJupyterGISModel;
    commandRegistry: CommandRegistry;
  }) {
    this._view = new ObservableMap<JSONValue>();
    this._mainViewModel = new MainViewModel({
      jGISModel: options.model,
      viewSetting: this._view,
      commands: options.commandRegistry,
    });
  }

  _initView(
    formSchemaRegistry?: IJGISFormSchemaRegistry,
    annotationModel?: IAnnotationModel,
  ) {
    this._jupyterGISMainViewPanel = new JupyterGISMainViewPanel({
      mainViewModel: this._mainViewModel,
      state: this._state,
      formSchemaRegistry: formSchemaRegistry,
      annotationModel: annotationModel,
    });
    this.addWidget(this._jupyterGISMainViewPanel);
    SplitPanel.setStretch(this._jupyterGISMainViewPanel, 1);
  }

  get jupyterGISMainViewPanel(): JupyterGISMainViewPanel {
    return this._jupyterGISMainViewPanel;
  }

  get viewChanged(): ISignal<
    ObservableMap<JSONValue>,
    IObservableMap.IChangedArgs<JSONValue>
  > {
    return this._view.changed;
  }

  /**
   * Dispose of the resources held by the widget.
   */
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    if (this._consoleView) {
      this._consoleView.dispose();
    }
    Signal.clearData(this);
    this._mainViewModel.dispose();
    super.dispose();
  }

  get currentViewModel(): MainViewModel {
    return this._mainViewModel;
  }

  get consolePanel(): ConsolePanel | undefined {
    return this._consoleView?.consolePanel;
  }

  get consoleOpened(): boolean {
    return this._consoleOpened;
  }

  executeConsole() {
    if (this._consoleView) {
      this._consoleView.execute();
    }
  }

  removeConsole() {
    if (this._consoleView) {
      this._consoleView.dispose();
      this._consoleView = undefined;
      this._consoleOpened = false;
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 250);
    }
  }

  async toggleConsole(jgisPath: string) {
    if (!this._consoleView) {
      const {
        contentFactory,
        manager,
        mimeTypeService,
        rendermime,
        commandRegistry,
      } = this._consoleOption;
      if (
        contentFactory &&
        manager &&
        mimeTypeService &&
        rendermime &&
        commandRegistry &&
        this._consoleTracker
      ) {
        this._consoleView = new ConsoleView({
          contentFactory,
          manager,
          mimeTypeService,
          rendermime,
          commandRegistry,
        });
        const { consolePanel } = this._consoleView;

        (this._consoleTracker.widgetAdded as any).emit(consolePanel);
        await consolePanel.sessionContext.ready;
        this.addWidget(this._consoleView);
        this.setRelativeSizes([2, 1]);
        this._consoleOpened = true;
        await consolePanel.console.inject(
          `from jupytergis import GISDocument\ndoc = GISDocument("${jgisPath}")`,
        );
        consolePanel.console.sessionContext.kernelChanged.connect((_, arg) => {
          if (!arg.newValue) {
            this.removeConsole();
          }
        });
      }
    } else {
      if (this._consoleOpened) {
        this._consoleOpened = false;
        this.setRelativeSizes([1, 0]);
      } else {
        this._consoleOpened = true;
        this.setRelativeSizes([2, 1]);
      }
    }
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 250);
  }

  private _state: IStateDB | undefined;
  private _mainViewModel: MainViewModel;
  private _view: ObservableMap<JSONValue>;
  private _jupyterGISMainViewPanel: JupyterGISMainViewPanel;
  private _consoleView?: ConsoleView;
  private _consoleOpened = false;
  private _consoleOption: Partial<ConsoleView.IOptions>;
  private _consoleTracker: IConsoleTracker | undefined;
}

export namespace JupyterGISPanel {
  export interface IOptions extends Partial<ConsoleView.IOptions> {
    model: IJupyterGISModel;
    commandRegistry: CommandRegistry;
    state?: IStateDB;
    consoleTracker?: IConsoleTracker;
    formSchemaRegistry?: IJGISFormSchemaRegistry;
    annotationModel?: IAnnotationModel;
  }
}
