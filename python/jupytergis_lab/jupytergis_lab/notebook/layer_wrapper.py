class CustomVectorWrapper:
    def __init__(self, base_layer):
        self._base_layer = base_layer

    def hello(self):
        print("Hello world")

    def show_layer(self):
        print("Showing layer:", self._base_layer.parameters)

    def toggle_visibility(self):
        self._base_layer.visible = not self._base_layer.visible

    def __getattr__(self, name):
        return getattr(self._base_layer, name)
