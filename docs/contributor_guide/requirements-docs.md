## Building Local JupyterGIS Documentation Workflow

To install a conda environment with **([Micromamba](https://mamba.readthedocs.io/en/latest/installation/micromamba-installation.html))**, run the following command inside `docs/`:

### **1. Create the environment from `environment-docs.yml`**

```
micromamba create -f environment-docs.yml
```

### **2. Activate the `jupytergis-docs` environment**

```
micromamba activate jupytergis-docs
```

### **3. Build the Documentation**

```
make html
```

### **4. Open the Documentation**

Once the build is complete, open:

```
docs/build/index.html
```

### **5. Make Changes and Rebuild**

After making docs edits, rerun:

```
make html
```

to regenerate the updated documentation.
