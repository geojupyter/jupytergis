(collab)=

# Collaborative Features

One of the standout features of JupyterGIS is its shared editing functionality, which **seamlessly connects users across different interfaces within the JupyterGIS ecosystem**. Whether collaborators are using the JupyterLab GIS extension, or working with the Python API in a Notebook, **any changes made to a shared document are instantly reflected for all users**.

## Create Collaborative JupyterGIS Sessions
If you are using a local installation, your JupyterLab instance is not available to the Internet by default, thus collaborators cannot join your session directly. Here are two techniques to facilitating collaboration in such instances.

1. Hosting a local server using VSCode (Microsoft) or PyCharm (Jetbrains) enables real-time collaboration without exposing your server to the Internet.
    - To use VSCode's Live Share, you can follow the steps [here](https://learn.microsoft.com/en-us/visualstudio/liveshare/use/share-server-visual-studio-code#share-a-server). 
    - To use PyCharm's Code With Me, first you can enable [Code With Me](https://www.jetbrains.com/help/pycharm/code-with-me.html), then set up [port forwarding](https://www.jetbrains.com/help/pycharm/code-with-me.html#port_forwarding).
   
    In both cases, you should forward the port of the JupyterLab instance. The default port is `8888`.
2. For a more scalable alternative, consider hosting JupyterGIS on a cloud-based or network-accessible instance. This setup allows multi-user cooperation with authentication and access restriction, without requiring a local installation. Once the instance is created using any of the options below, JupyterGIS needs to be installed on the created instance by opening a terminal window and following [the installation guide](../install.md).
    - [JupyterHub](https://jupyter.org/hub): You can follow [the JupyterHub documentation](https://jupyter.org/hub#deploy-a-jupyterhub) for setup instructions. By default, JupyterHub creates isolated environments for each user. To enable real-time collaboration on the same environment, you can follow [this guide](https://jupyterhub.readthedocs.io/en/5.2.1/reference/sharing.html#sharing-reference).
    - [Binder](https://mybinder.readthedocs.io/en/latest/index.html): Check out [this tutorial](https://book.the-turing-way.org/communication/binder/zero-to-binder) to start using Binder. Note that when you share the link with a collaborator, they will be asked to enter the password or token to access the session. You can find out the token by opening a terminal window and running the command 
      ```
      jupyter notebook list --json | python3 -c 'import json; import sys; print(json.load(sys.stdin)["token"])'
      ```
      Note that if you have added JupyterGIS to the `requirements.txt` file, it will be installed automatically when you create the Binder instance. In this case you do not need to follow [the installation guide](../install.md).
    - [Amazon SageMaker AI](https://aws.amazon.com/sagemaker-ai): If you prefer to use Amazon SageMaker AI, you can follow [this tutorial](https://docs.aws.amazon.com/sagemaker/latest/dg/onboard-quick-start.html) to set up your environment. After opening SageMaker Studio, create a JupyterLab space, and make sure choosing `Share with my domain` option to enable access for your collaborators.

Note that currently, real-time collaboration is not supported in [JupyterLite](https://jupytergis.readthedocs.io/en/latest/lite/lab/index.html).
