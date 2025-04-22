export class StateManager {
  private static instance: StateManager;
  private state: Record<string, any>;

  private constructor() {
    this.state = {};
  }

  public static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  public getState(): Record<string, any> {
    return this.state;
  }

  public setState(state: Record<string, any>): void {
    this.state = state;
  }
}
