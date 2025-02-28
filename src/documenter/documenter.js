// Copyright 2021 Teros Technology
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

const fs = require('fs');
const path_lib = require('path');
const Diagram = require('./diagram');
const ParserLib = require('../parser/factory');
const css_const_style = require('./css_style');
const showdown = require('showdown');
const markdown_lib = require('./markdown');
const utils = require('./utils');
const translator_lib = require('./translator');
const documenter_interface = require('./documenter_interface');

class Documenter extends markdown_lib.Markdown {
  constructor(config) {
    super();
    this.set_config(config);
    this.init_parser = false;
  }

  set_config(config) {
    if (config === undefined) {
      this.config = {
        'fsm': true,
        'signals': 'all',
        'constants': 'all',
        'process': 'all',
        'self_contained': false
      };
    }
    else {
      this.config = config;
    }
  }

  // ***************************************************************************
  // Save
  // ***************************************************************************
  async save_html(code, lang, configuration, path) {
    configuration.html_style = 'save';
    configuration.extra_top_space = false;

    let html_result = await this.get_html(code, lang, configuration);
    let html_doc = html_result.html;

    //Save the document only if no error
    if (html_result.error === false){
      fs.writeFileSync(path, html_doc);
    }
    return html_result.error;
  }

  async save_markdown(code, lang, configuration, path) {
    let dirname_svg = path_lib.dirname(path);
    let filename_svg = path_lib.basename(path, path_lib.extname(path)) + ".svg";
    let path_svg = path_lib.join(dirname_svg, filename_svg);

    let result = await this._get_markdown(code, lang, configuration, path_svg);
    if (result.error !== true){
      fs.writeFileSync(path, result.markdown);
    }
    return result.error;
  }

  async save_svg(code, lang, configuration, path) {
    let code_tree = await this._get_code_tree(code, lang, configuration);
    if (code_tree === undefined) {
      return;
    }

    let svg_diagram_str = await this._get_diagram_svg_from_code_tree(code_tree);
    await fs.writeFileSync(path, svg_diagram_str);
    await this._save_fsms(code_tree, code, lang, configuration, path);
    await this._save_wavedrom(code_tree, path);
  }
  // ***************************************************************************
  // Document creator
  // ***************************************************************************
  async _get_markdown(code, lang, configuration, path_svg) {
    let translator = new translator_lib.Translator(configuration['language']);

    let code_tree = await this._get_code_tree(code, lang, configuration);
    if (code_tree === undefined) {
      return { 'markdown': '', error: true };
    }

    let extra_top_space_l = "";
    if (configuration.extra_top_space === true) {
      extra_top_space_l = "&nbsp;&nbsp;\n\n";
    }

    let markdown_doc = extra_top_space_l;
    let filename = '';
    if (configuration.input_path !== undefined){
      filename = path_lib.basename(configuration.input_path);
    }

    //Entity
    if (code_tree['entity'] !== undefined) {
      if (code_tree['entity']['name'] === ''){
        return { 'markdown': '', error: true };
      }

      //Title
      if (code_tree['info'] !== undefined && code_tree['info']['title'] !== undefined){
        markdown_doc += "# " + code_tree['info']['title'] + "\n\n";
      }else{
        markdown_doc += `# ${translator.get_str('Entity')}: ${code_tree['entity']['name']} \n\n`;
      }
      if (configuration.input_path !== undefined){
        markdown_doc += `- **${translator.get_str('File')}**: ${filename}\n`;
      }
      //Optional info section
      markdown_doc += this._get_info_section(code_tree, translator);
      //Custom section
      markdown_doc += this.get_custom_section('begin', 'markdown', code_tree, configuration, translator);
      //Diagram
      await this._save_svg_from_code_tree(path_svg, code_tree, translator);
      markdown_doc += `## ${translator.get_str('Diagram')}\n\n`;
      if (configuration.custom_svg_path_in_readme !== undefined){
        markdown_doc +=
            `![${translator.get_str('Diagram')}]( ${configuration.custom_svg_path_in_readme} "${translator.get_str('Diagram')}")`;
      }
      else{
        markdown_doc +=
            `![${translator.get_str('Diagram')}](${path_lib.basename(path_svg)} "${translator.get_str('Diagram')}")`;
      }
      markdown_doc += "\n";
      //Description
      let description_inst = code_tree['entity']['description'];
      if (description_inst.trim() !== '') {
        markdown_doc += `## ${translator.get_str('Description')}\n\n`;
        const { description, wavedrom } = utils.get_wavedrom_svg(description_inst);
        let wavedrom_description = description;
        for (let i = 0; i < wavedrom.length; ++i) {
          let random_id = utils.makeid(4);
          let img = `![alt text](wavedrom_${random_id}${i}.svg "title")`;
          let path_img = path_lib.dirname(path_svg) + path_lib.sep + `wavedrom_${random_id}${i}.svg`;
          fs.writeFileSync(path_img, wavedrom[i]);
          wavedrom_description = wavedrom_description.replace("$cholosimeone$" + i, img);
        }
        markdown_doc += wavedrom_description;
      }
      //Custom section
      if (configuration.custom_section !== undefined){
        markdown_doc += `\n${configuration.custom_section}\n`;
      }
      //Generics and ports
      markdown_doc += this._get_in_out_section(code_tree['ports'], code_tree['generics'],
          code_tree['virtual_buses'], translator);
    }
    //Package
    if (code_tree.package !== undefined) {
      if (code_tree['package']['name'] === ''){
        return { 'markdown': '', error: true };
      }

      //Title
      if (code_tree['info'] !== undefined && code_tree['info']['title'] !== undefined){
        markdown_doc += "# " + code_tree['info']['title'] + "\n";
      }else{
        markdown_doc += `# ${translator.get_str('Package')}: ${code_tree['package']['name']} \n\n`;
      }
      if (configuration.input_path !== undefined){
        markdown_doc += `- **${translator.get_str('File')}**: ${filename}\n`;
      }
      //Optional info section
      markdown_doc += this._get_info_section(code_tree, translator);
      //Custom section
      markdown_doc += this.get_custom_section('begin', 'markdown', code_tree, configuration, translator);
      //Description
      let description_inst = code_tree['package']['description'];
      if (description_inst.trim() !== '') {
        markdown_doc += `## ${translator.get_str('Description')}\n\n`;
        markdown_doc += code_tree['package']['description'] + "\n";
      }

      //Custom section
      if (configuration.custom_section !== undefined){
        markdown_doc += `\n${configuration.custom_section}\n`;
      }
    }

    //Interface
    if (code_tree.interface !== undefined) {
      let documenter_interface_inst = new documenter_interface.Documenter_interface(translator, 'markdown');
      markdown_doc += documenter_interface_inst.get_doc(code_tree, filename);
    }

    //Signals, constants and types
    if (code_tree['declarations'] !== undefined) {
      markdown_doc += this._get_signals_constants_section(
        code_tree['declarations']['signals'], code_tree['declarations']['constants'],
        code_tree['declarations']['types'], configuration, translator);
      //Functions
      markdown_doc += this._get_functions_section(code_tree['declarations']['functions'],
            configuration, 'markdown', translator);
    }
    if (code_tree['body'] !== undefined) {
      //Processes
      markdown_doc += this._get_process_section(code_tree['body']['processes'], configuration, 'markdown', translator);
      //Instantiations
      markdown_doc += this._get_instantiations_section(code_tree['body']['instantiations'],
        configuration, 'markdown', translator);
    }

    // State machine diagrams
    let stm_array = await this._get_stm(code, lang, configuration, translator);
    if (this.config.fsm === true && stm_array !== undefined && stm_array.length !== 0) {
      markdown_doc += `## ${translator.get_str('State machines')}\n\n`;
      for (let i = 0; i < stm_array.length; ++i) {
        let entity_name = code_tree['entity']['name'];
        let stm_path = `${path_lib.dirname(path_svg)}${path_lib.sep}stm_${entity_name}_${i}${i}.svg`;
        if (stm_array[i].description !== '') {
          markdown_doc += '- ' + stm_array[i].description;
        }
        fs.writeFileSync(stm_path, stm_array[i].svg);
        markdown_doc += `![Diagram_state_machine_${i}]( stm_${entity_name}_${i}${i}.svg "Diagram")`;
      }
    }
    //Custom section
    markdown_doc += this.get_custom_section('end', 'markdown', code_tree, configuration, translator);
    return { 'markdown': markdown_doc, error: false };
  }

  get_custom_section(position, type, code_tree, configuration){
    let directory_base = '';
    if (configuration.input_path !== undefined){
      directory_base = path_lib.dirname(configuration.input_path);
    }

    let info = code_tree['info'];
    if (info === undefined){
      return '';
    }
    let file_path = '';
    if (position === 'begin' && info.custom_section_begin !== undefined){
      let base_path = info.custom_section_begin.trim();
      if(path_lib.isAbsolute(base_path)) {
        file_path = base_path;
      }
      else{
        file_path = path_lib.join(directory_base,base_path);
      }
    }
    else if (position === 'end' && info.custom_section_end !== undefined){
      let base_path = info.custom_section_end.trim();
      if(path_lib.isAbsolute(base_path)) {
        file_path = base_path;
      }
      else{
        file_path = path_lib.join(directory_base,base_path);
      }
    }

    if (fs.existsSync(file_path) === false){
      return '';
    }

    let result = fs.readFileSync(file_path, {encoding:'utf8', flag:'r'});
    if (type === 'html'){
      const showdownHighlight = require("showdown-highlight");
      let converter = new showdown.Converter({ tables: true, ghCodeBlocks: true,
        extensions: [showdownHighlight({
          // Whether to add the classes to the <pre> tag
          pre: true
        })]
      });

      converter.setFlavor('github');
      result = converter.makeHtml(result);
    }
    if (result !== ''){
      result = '\n' + result + '\n';
    }
    return result;
  }

  async get_html(code, lang, configuration) {
    let translator = new translator_lib.Translator(configuration['language']);

    let code_tree = await this._get_code_tree(code, lang, configuration);
    if (code_tree === undefined) {
      return { 'html': '', error: true };
    }

    let html_style = '';
    if (configuration.html_style === "save") {
      html_style = `<div id="teroshdl" class='templateTerosHDL'>\n`;
      html_style = css_const_style.html_style_save + html_style;
    }
    else {
      html_style = `<div id="teroshdl" class='templateTerosHDL' style="overflow-y:auto;height:100%;width:100%">\n`;
      html_style = '';
      html_style = css_const_style.html_style_preview + html_style;
    }

    //HTML style
    let html = "";
    if (configuration.html_style === 'none'){
      html = '';
    }
    else if (configuration.custom_css_path !== undefined && fs.existsSync(configuration.custom_css_path) === true ) {
      try {
        let custom_css_str = fs.readFileSync(configuration.custom_css_path, { encoding: 'utf8' });
        html = `<style>\n${custom_css_str}</style>\n`;
      }
      catch (e) {
        // eslint-disable-next-line no-console
        console.log(e);
        html = html_style;
      }
    }
    else {
      html = html_style;
    }
    const showdownHighlight = require("showdown-highlight");
    let converter = new showdown.Converter({ tables: true, ghCodeBlocks: true,
      extensions: [showdownHighlight({
        // Whether to add the classes to the <pre> tag
        pre: true
      })]
    });
    converter.setFlavor('github');

    if (configuration.extra_top_space === true){
      html += "<br><br>\n";
    }
    let filename = '';
    if (configuration.input_path !== undefined){
      filename = path_lib.basename(configuration.input_path);
    }
    //Entity
    if (code_tree['entity'] !== undefined) {
      if (code_tree['entity']['name'] === ''){
        return { 'html': '', error: true };
      }
      //Title
      let doc_title;
      let name = '';
      if (code_tree['info'] !== undefined && code_tree['info']['title'] !== undefined){
        name = code_tree['info']['title'];
        doc_title = "# " + name + "\n";
      }else{
        name = code_tree['entity']['name'];
        doc_title = `# ${translator.get_str('Entity')}: ${name} \n`;
      }
      html += `<a id=${name}>` + converter.makeHtml(doc_title) + '</a>';
      if (configuration.input_path !== undefined){
        html += converter.makeHtml(`- **${translator.get_str('File')}**: ${ filename}\n`);
      }
      html += converter.makeHtml(this._get_info_section(code_tree, translator));
      //Custom section
      html += this.get_custom_section('begin', 'html', code_tree, configuration, translator);
      //Diagram
      html += converter.makeHtml(`## ${translator.get_str('Diagram')}\n`);
      html += converter.makeHtml((await this._get_diagram_svg_from_code_tree(code_tree) + 
          "\n").replace(/\*/g, "\\*").replace(/S`/g, "\\`"));
      //Description
      let inst_description = code_tree['entity']['description'];
      if (inst_description.trim() !== ''){
        html += converter.makeHtml(`## ${translator.get_str('Description')}\n\n`);
        let { description, wavedrom } = utils.get_wavedrom_svg(code_tree['entity']['description']);

        description = utils.remove_description_first_space(description).trim();
        let html_description = converter.makeHtml(description);

        for (let i = 0; i < wavedrom.length; ++i) {
          html_description = html_description.replace("$cholosimeone$" + i, wavedrom[i]);
        }
        html_description = utils.normalize_description(html_description);
        html += '<div id="teroshdl_description">' + html_description + '</div>';
      }
      //Generics and ports
      html += converter.makeHtml(this._get_in_out_section(code_tree['ports'], 
            code_tree['generics'],code_tree['virtual_buses'], translator));
    }
    //Package
    if (code_tree.package !== undefined) {
      if (code_tree['package']['name'] === ''){
        return { 'html': '', error: true };
      }
      //Title
      let doc_title;
      let name = '';
      if (code_tree['info'] !== undefined && code_tree['info']['title'] !== undefined){
        name = code_tree['info']['title'];
        doc_title = "# " + code_tree['info']['title'] + "\n\n";
      }else{
        name =  code_tree['package']['name'];
        doc_title = `# ${translator.get_str('Package')}: ${code_tree['package']['name']}\n\n`;
      }
      html += `<a id=${name}>` + converter.makeHtml(doc_title) + '</a>';

      if (configuration.input_path !== undefined) {
        html += converter.makeHtml(`- **${translator.get_str('File')}**: ` + filename + '\n');
      }
      html += converter.makeHtml(this._get_info_section(code_tree, translator));
      //Custom section
      html += this.get_custom_section('begin', 'html', code_tree, configuration, translator);
      let inst_description = code_tree['package']['description'];
      if (inst_description.trim() !== ''){
        html += converter.makeHtml("## Description\n\n");
        html += '<div id="teroshdl_description">' 
              + converter.makeHtml(code_tree['package']['description'] + "</div>\n");
      }
    }

    //Interface
    if (code_tree.interface !== undefined){
      let documenter_interface_inst = new documenter_interface.Documenter_interface(translator, 'html');
      html += documenter_interface_inst.get_doc(code_tree, filename);
    }

    if (code_tree['declarations'] !== undefined) {
      //Signals and constants
      html += converter.makeHtml(this._get_signals_constants_section(
        code_tree['declarations']['signals'], code_tree['declarations']['constants'],
        code_tree['declarations']['types'], configuration, translator));
      //Functions
      html += this._get_functions_section(code_tree['declarations']['functions'], configuration, 'html', translator);
    }
    if (code_tree['body'] !== undefined) {
      //Processes
      html += this._get_process_section(code_tree['body']['processes'], configuration, 'html', translator);
      //Instantiations
      html += this._get_instantiations_section(code_tree['body']['instantiations'], configuration, 'html', translator);
    }

    // State machine diagrams
    let stm_array = await this._get_stm(code, lang, configuration);
    if (this.config.fsm === true && stm_array !== undefined && stm_array.length !== 0) {
      html += converter.makeHtml(`## ${translator.get_str('State machines')}\n\n`);
      html += '<div>';
      for (let i = 0; i < stm_array.length; ++i) {
        if (stm_array[i].description !== '') {
          html += converter.makeHtml('- ' + stm_array[i].description);
        }
        html += `<div id="state_machine">${stm_array[i].svg}</div>`;
      }
      html += '</div>';
    }
    //Custom section
    html += this.get_custom_section('end', 'html', code_tree, configuration, translator);
    html += '<br><br><br><br><br><br>';
    html += `
    </article class="markdown-body">

    </body>
    
    `;
    return { 'html': html, error: false };
  }

  async _get_diagram_svg_from_code_tree(code_tree) {
    let svg_diagram_str = await Diagram.diagramGenerator(code_tree, 0);
    return svg_diagram_str;
  }

  async _save_svg_from_code_tree(path, code_tree) {
    let svg_diagram_str = await this._get_diagram_svg_from_code_tree(code_tree);
    fs.writeFileSync(path, svg_diagram_str);
  }

  async _save_fsms(code_tree, code, lang, configuration, path) {
    let stm_array = await this._get_stm(code, lang, configuration);
    for (let i = 0; i < stm_array.length; ++i) {
      let entity_name = code_tree['entity']['name'];
      let stm_path = `${path_lib.dirname(path)}${path_lib.sep}stm_${entity_name}_${i}${i}.svg`;
      fs.writeFileSync(stm_path, stm_array[i].svg);
    }
  }

  async _save_wavedrom(code_tree, path) {
    if (code_tree === undefined) {
      return;
    }
    const { description, wavedrom } = utils.get_wavedrom_svg(code_tree['entity']['description']);
    let wavedrom_description = description;
    for (let i = 0; i < wavedrom.length; ++i) {
      let random_id = utils.makeid(4);
      let img = `![alt text](wavedrom_${random_id}${i}.svg "title")`;
      let path_img = path_lib.dirname(path) + path_lib.sep + `wavedrom_${random_id}${i}.svg`;
      fs.writeFileSync(path_img, wavedrom[i]);
      wavedrom_description = wavedrom_description.replace("$cholosimeone$" + i, img);
    }
  }

  // ***************************************************************************
  // Parsers
  // ***************************************************************************
  async _get_code_tree(code, lang, configuration) {
    let parser = await this.get_parser(lang);
    let symbol = '';
    if (lang === 'vhdl'){
      symbol = configuration.symbol_vhdl;
    }
    else{
      symbol = configuration.symbol_verilog;
    }
    let code_tree = await parser.get_all(code, symbol);
    return code_tree;
  }

  async init() {
    await this.create_parser('vhdl');
    await this.create_parser('verilog');
    this.init_parser = true;
  }

  async get_parser(lang) {
    if (this.init_parser === false) {
      await this.init();
    }

    if (lang === 'vhdl') {
      return this.vhdl_parser;
    }
    else if (lang === 'verilog') {
      return this.verilog_parser;
    }
    else {
      return undefined;
    }
  }

  async create_parser(lang) {
    let parser = new ParserLib.ParserFactory;
    if (lang === 'vhdl') {
      //VHDL parser
      this.vhdl_parser = await parser.getParser(lang);
    }
    else if (lang === 'verilog') {
      //Verilog parser
      this.verilog_parser = await parser.getParser(lang);
    }
  }

  async _get_stm(code, lang, configuration) {
    if (configuration.fsm === false){
      return [];
    }
    let symbol = '';
    if (lang === 'vhdl'){
      symbol = configuration.symbol_vhdl;
    }
    else{
      symbol = configuration.symbol_verilog;
    }
    let parser = await this.get_parser(lang);
    let stm_array = await parser.get_svg_sm(code, symbol);
    return stm_array.svg;
  }
}

module.exports = {
  Documenter: Documenter
};
