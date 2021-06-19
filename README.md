![Tests](https://github.com/TerosTechnology/colibri/workflows/Linux/badge.svg?event=push)
![Tests](https://github.com/TerosTechnology/colibri/workflows/Macos/badge.svg?event=push)
![Tests](https://github.com/TerosTechnology/colibri/workflows/Windows/badge.svg?event=push)
![Test_unit_suites](https://github.com/TerosTechnology/colibri/workflows/Test_unit_suites/badge.svg?event=push)


# TerosHDL backend

## Documenter CI

- Installation:

```
sudo npm install -g .
```
- Commands
```
'-f, --file [path]', Path of the YML file to documenter
'-o, --out  [type]', Documentation format: md, html
```

### Documenter examples:

**Documenter with yml file**
```
cd /bin/example
teroshdl-hdl-documenter -f example.yml
```

**Documenter with teros project manager file or EDAM file**

Documentation will be generated in `./built_doc`
```
cd /bin/example
teroshdl-hdl-documenter -e example_edam.yml 
teroshdl-hdl-documenter -e example_edam.yml -o html 
```


## Third-party

The `s3sv` formatter is taken from the [SystemVerilog](https://www.github.com/TheClams/SystemVerilog) project. 
See informations about license and changes if any in the corresponding folder `src/formatter/bin/s3sv`.


