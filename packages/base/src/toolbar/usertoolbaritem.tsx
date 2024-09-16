import { IUserData, JupyterGISModel } from '@jupytergis/schema';
import * as React from 'react';

interface IProps {
  model: JupyterGISModel;
}

interface IState {
  usersList: IUserData[];
  selectedUser?: IUserData;
}

export class UsersItem extends React.Component<IProps, IState> {
  constructor(props: IProps) {
    super(props);
    this._model = props.model;
    this.state = { usersList: [] };
  }

  componentDidMount(): void {
    this.setState(old => ({ ...old, usersList: this._model.users }));
    this._model.userChanged.connect((_, usersList) => {
      this.setState(old => ({ ...old, usersList: usersList }));
    });
  }

  selectUser = (user: IUserData): void => {
    let selected: IUserData | undefined = undefined;
    if (user.userId !== this.state.selectedUser?.userId) {
      selected = user;
    }
    this.setState(
      old => ({ ...old, selectedUser: selected }),
      () => {
        this._model.setUserToFollow(selected?.userId);
      }
    );
  };

  private createUserIcon(options: IUserData): JSX.Element {
    let el: JSX.Element;
    const { userId, userData } = options;
    const selected = `${
      userId === this.state.selectedUser?.userId ? 'selected' : ''
    }`;
    if (userData.avatar_url) {
      el = (
        <div
          key={userId}
          title={userData.display_name}
          className={`lm-MenuBar-itemIcon jp-MenuBar-imageIcon ${selected}`}
          onClick={() => this.selectUser(options)}
        >
          <img src={userData.avatar_url} alt="" />
        </div>
      );
    } else {
      el = (
        <div
          key={userId}
          title={userData.display_name}
          className={`lm-MenuBar-itemIcon jp-MenuBar-anonymousIcon ${selected}`}
          style={{ backgroundColor: userData.color }}
          onClick={() => this.selectUser(options)}
        >
          <span>{userData.initials}</span>
        </div>
      );
    }

    return el;
  }

  private filterDuplicated(usersList: IUserData[]): IUserData[] {
    const newList: IUserData[] = [];
    const selected = new Set<string>();
    for (const element of usersList) {
      if (
        element?.userData?.username &&
        !selected.has(element.userData.username)
      ) {
        selected.add(element.userData.username);
        newList.push(element);
      }
    }
    return newList;
  }

  render(): React.ReactNode {
    return (
      <div className="jGIS-toolbar-usertoolbar">
        {this.filterDuplicated(this.state.usersList).map(item => {
          if (item.userId !== this._model.currentUserId) {
            return this.createUserIcon(item);
          }
        })}
      </div>
    );
  }

  private _model: JupyterGISModel;
}
