# Add a command

A ["command"](https://jupyterlab.readthedocs.io/en/stable/user/commands.html)
is a behavior that can be triggered from a menu in the JupyterGIS UI.

## To add a new command in JupyterGIS

* Get started with `packages/base/src/constants.ts` where we’ll add a new command ID to
  the `CommandIDs` namespace for the command you’re going to define.

  ```typescript
  export namespace CommandIDs {
    // ...
    export const myNewCommand = 'jupytergis:myNewCommand';
    // ...
  }
  ```

* In the same file, add an icon for your command to the `iconObject` mapping.
  We use Font Awesome 5 icons.
  You can find icons and the corresponding icon class string by searching
  [here](https://fontawesome.com/v5/icons).

  ```typescript
	const iconObject = {
		// ...
		[CommandIDs.myNewCommand]: { iconClass: 'fas fa-question' },
		// ...
	}
  ```

* Add your command to the command registry in `packages/base/src/commands.ts`.
  Inside the `addCommands()` function definition, add a new call to
  `commands.addCommand()`.
  Pass in your label, behaviors, and icon.


  ```typescript
	export function addCommands(
		// ...
	): void {
		// ...

		commands.addCommand(CommandIDs.myNewCommand, {
			label: trans.__('My new command label'),
			isEnabled: (): boolean => { /* ... */ },
			execute: (): void => { /* ... */ },
			...icons.get(CommandIDs.myNewCommand)
		});

    // ...
  }
  ```

  * The `label` parameter defines the text that will be displayed in the UI (e.g. in
  menus, command palette, or hover text).
  * Your `isEnabled()` function is called to determine whether the command is available
  (i.e., active/clickable) based on the current state of the application.
  * `execute()` defines what happens when the command is triggered (e.g. user clicks the
  menu item or presses a keyboard shortcut).

* Add your command to the toolbar in `packages/base/src/toolbar/widget.tsx`.
  Within the `ToolbarWidget` class' `constructor()` method, add a new call to
  `this.addItem()`.
  Pass in your command ID object, label, and the JupyterGIS command registry as a bare
  minimum.
  The icon we set earlier will be found automatically.

  ```typescript
	export class ToolbarWidget extends ReactiveToolbar {
		constructor(options: ToolbarWidget.IOptions) {
      // ...

			if (options.commands) {
        // ...

				this.addItem(
					'myNewCommand',
					new CommandToolbarButton({
						id: CommandIDs.myNewCommand,
						label: '',
						commands: options.commands
					})
				);

        // ...
      }
    }
  }
  ```

* Re-build JupyterGIS (`jlpm run build`) and test!
