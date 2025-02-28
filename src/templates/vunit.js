// Copyright 2020 Teros Technology
//
// Ismael Perez Rojo
// Carlos Alberto Ruiz Naranjo
// Alfredo Saez
//
// This file is part of Colibri.
//
// Colibri is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Colibri is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Colibri.  If not, see <https://www.gnu.org/licenses/>.

class runpy {
  constructor(){
    this.str     = "";
    this.str_out = "";
    this.path = require('path');
  }
  generate(options){
    this.str     = options;
    this.header();
    this.python_libraries();
    this.set_lang();
    this.separator();
    this.checks();
    this.separator();
    this.check_simulator();
    this.separator();
    this.vunit_instance();
    this.add_src();
    this.addTb();
    this.check_calls();
    this.separator();
    this.simulator_suport();
    this.separator();
    this.post_run_fcn();
    this.separator();
    this.run();
    return this.str_out;
  }

  header(){
    this.str_out = "# -*- coding: utf-8 -*-\n";
  }
  python_libraries(){
    this.str_out += "from os.path import join , dirname, abspath\nimport subprocess\nfrom vunit.sim_if.ghdl ";
    this.str_out += "import GHDLInterface\nfrom vunit.sim_if.factory import SIMULATOR_FACTORY\n";
  }
  set_lang(){
    if (this.str.lang==="vhdl") {
      this.str_out += "from vunit   import VUnit, VUnitCLI\n";
    }
    else if(this.str.lang==="verilog"){
      this.str_out += "from vunit.verilog   import VUnit, VUnitCLI\n";
    }
  }
  separator(){
    this.str_out += "\n################################################################################\n";
  }
  checks(){
    if (this.str.config.checks) {
      this.str_out += "#pre_config func\n";
      this.str_out += "def pre_config_func():\n";
      this.str_out += '    """\n';
      this.str_out += "    Before test.\n";
      this.str_out += '    """\n';
      this.str_out += "#post_check func\n";
      this.str_out += "def post_check_func():\n";
      this.str_out += '    """\n';
      this.str_out += "    After test.\n";
      this.str_out += '    """\n';
      this.str_out += "    def post_check(output_path):\n";
      this.str_out += "        check = True\n";
      this.str_out += "        return check\n";
      this.str_out += "    return post_check\n";
    }
  }
  check_simulator(){
    this.str_out += "#Check simulator.\n";
    this.str_out += 'print ("=============================================")\n';
    this.str_out += 'simname = SIMULATOR_FACTORY.select_simulator().name\n';
    if (this.str.config.simulator_suport.modelsim.enable) {
      this.check_modelsim();
    }
    if (this.str.config.simulator_suport.ghdl.enable) {
      this.check_ghdl();
    }
    this.str_out += 'print ("Simulator = " + simname)\n';
    this.str_out += 'print ("=============================================")\n';
  }
  check_modelsim(){
    this.str_out += 'code_coverage = False\n';
    this.str_out += 'if (simname == "modelsim"):\n';
    this.str_out += '    f= open("modelsim.do","w+")\n';
    this.str_out += '    f.write("add wave * \\nlog -r /*\\nvcd file\\nvcd add -r /*\\n")\n';
    this.str_out += '    f.close()\n';
  }
  check_ghdl(){
    this.str_out += 'code_coverage = (simname == "ghdl" and \\\n';
    this.str_out += '                (GHDLInterface.determine_backend("")=="gcc" or  \\\n';
    this.str_out += '                GHDLInterface.determine_backend("")=="GCC"))\n';
  }
  vunit_instance(){
    this.str_out += '#VUnit instance.\n';
    this.str_out += 'ui = VUnit.from_argv()\n';
  }
  add_src(){
    this.str_out += '\n#Add module sources.\n';
    this.str_out += this.str.config["name"] + '_src_lib = ui.add_library("src_lib")\n';
    for(var x = 0; x < this.str.src.length;x++){
      let file = this.path.relative(this.str.config["output_path"],this.str.src[x]);
      file.replace("\\","\\\\");
      this.str_out += this.str.config["name"] + '_src_lib.add_source_files("' + file + '")\n';
    }
  }
  addTb(){
    this.str_out += '\n#Add tb sources.\n';
    this.str_out += this.str.config["name"] + '_tb_lib = ui.add_library("tb_lib")\n';
    for(var x = 0; x < this.str.tb.length;x++){
      let file = this.path.relative(this.str.config["output_path"],this.str.tb[x]);
      file.replace("\\","\\\\");
      this.str_out += this.str.config["name"] + '_tb_lib.add_source_files("' + file + '")\n';
    }
  }
  check_calls(){
    if (this.str.config.checks) {
      let file = this.path.relative(this.str.config["output_path"],this.str.tb[0]);
      file.replace("\\","\\\\");
      this.str_out += '\n#func checks\n';
      this.str_out += 'tb_generated = '+this.str.config["name"] +'_tb_lib.test_bench("'+file.split(".")[0]+'")\n';
      this.str_out += 'for test in tb_generated.get_tests():\n';
      this.str_out += '    test.add_config(name="test_alive", pre_config=pre_config_func()';
      this.str_out += ',post_check=post_check_func())\n';
      }
    }
  simulator_suport(){
    if (this.str.config.simulator_suport.ghdl.enable) {
      this.str_out += '#Simulators flags.\n';
      this.str_out += 'if(code_coverage == True):\n';
      this.ghdl_config(true);
      this.str_out += 'else:\n';
      this.ghdl_config(false);
    }
    if (this.str.config.simulator_suport.modelsim.enable) {
      this.str_out += '\n';
      this.modelsim_config();
    }
    if (this.str.config.simulator_suport.ghdl.config.disable_ieee_warnings) {
      this.disable_ieee_warnings();
    }
  }
  ghdl_config(coverage){
    let flags_vars = ' ';
    let sim_vars   = ' ';
    let sep = ' ';
    if (this.str.config.simulator_suport.ghdl.config.synopsys_libraries) {
      let synopsys_var = '"-fexplicit","--ieee=synopsys","--no-vital-checks","-frelaxed-rules"';
      flags_vars += synopsys_var;
      sim_vars   += synopsys_var;
      sep = ',';
    }
    if (coverage) {
      if (this.str.config.simulator_suport.ghdl.config.code_coverage.enable) {
        let code_coverage_var = '"-fprofile-arcs","-ftest-coverage"';
        let code_coverage_sim = '"-Wl,-lgcov"';
        flags_vars += sep + code_coverage_var;
        sim_vars   += sep + code_coverage_sim;
      }
    }
    this.str_out += '    ' + this.str.config["name"] 
      + '_src_lib.add_compile_option   ("ghdl.flags"     , [ '+flags_vars+'])\n';
    this.str_out += '    ' + this.str.config["name"] 
      + '_tb_lib.add_compile_option    ("ghdl.flags"     , [ '+flags_vars+'])\n';
    this.str_out += '    ui.set_sim_option("ghdl.elab_flags", ['+sim_vars+'])\n';
  }
  modelsim_config(){
    this.str_out += 'ui.set_sim_option("modelsim.init_files.after_load" ,["modelsim.do"])\n';
    }
  disable_ieee_warnings(){
    this.str_out += 'ui.set_sim_option("disable_ieee_warnings", True)\n';
  }
  post_run_fcn(){
    this.str_out += 'def post_run_fcn(results):\n';
    this.str_out += '    if(code_coverage == True ):\n';
    for(var x=0;x<this.str.src.length;x++){
      this.str_out += '        subprocess.call(["lcov", "--capture", "--directory", "' 
                + this.path.basename(this.str.src[x]).split(".")[0] 
                + '.gcda", "--output-file",  "code_'+x.toString()+'.info" ])\n';
    }
    this.str_out += '        subprocess.call(["genhtml"';
    for(let x=0;x<this.str.src.length;x++){
      this.str_out +=  ',"code_' + x.toString()+ '.info"' ,
            +this.str.config.simulator_suport.ghdl.config.code_coverage["output_path"]+'"])\n';
    }
    this.str_out +=  ',"--output-directory", "'
        +this.str.config.simulator_suport.ghdl.config.code_coverage["output_path"]+'"])\n';
  }
  run(){
    this.str_out += '#Run tests.\n';
    this.str_out += 'ui.main(post_run=post_run_fcn)\n';
  }
}

module.exports = {
  runpy : runpy
};
