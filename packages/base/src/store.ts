import { IStateDB } from '@jupyterlab/statedb';
// Singleton class to manage Jupyter stateDb globally
export class GlobalStateDbManager {
  private static instance: GlobalStateDbManager;
  private stateDb: IStateDB | null = null;

  // Private constructor to prevent direct instantiation
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): GlobalStateDbManager {
    if (!GlobalStateDbManager.instance) {
      GlobalStateDbManager.instance = new GlobalStateDbManager();
    }
    return GlobalStateDbManager.instance;
  }

  public initialize(stateDb: IStateDB): void {
    if (this.stateDb === null) {
      this.stateDb = stateDb;
    } else {
      console.warn('stateDb is already initialized.');
    }
  }

  public getStateDb(): IStateDB | null {
    return this.stateDb;
  }
}
