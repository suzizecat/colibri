/* eslint-disable no-empty */
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

const path = require('path');
const ts_base_parser = require('./ts_base_parser');
const stm_parser = require('./vhdl_sm');

class Parser extends ts_base_parser.Ts_base_parser {
  constructor(comment_symbol) {
    super();
    this.comment_symbol = comment_symbol;
    this.loaded = false;
  }

  async init() {
    try{
      if (this.loaded !== true){
        this.code = '';
        const Parser = require('web-tree-sitter');
        await Parser.init();
        this.parser = new Parser();
        let Lang = await
          Parser.Language.load(path.join(__dirname, path.sep + "parsers" + path.sep + "tree-sitter-vhdl.wasm"));
        this.parser.setLanguage(Lang);
        this.loaded = true;
        this.stm_parser = new stm_parser.Paser_stm_vhdl(this.comment_symbol, this.parser);
      }
    }
    catch(e){}
  }
  
  async get_svg_sm(code, symbol) {
    return this.stm_parser.get_svg_sm(code, symbol);
  }

  parse(code) {
    if (this.code !== code) {
      this.tree = this.parser.parse(code);
      this.code = code;
    }
    return this.tree;
  }

  get_all(code, comment_symbol) {
    this.set_symbol(comment_symbol);
    if (this.loaded === false){
      return undefined;
    }
    let struct;
    let entity_file = this.get_entity_file(code);
    if (entity_file === undefined || entity_file.entity.name === '') {
      let package_file = this.get_package_file(code);
      struct = this.parse_doxy(package_file,"package");
    }
    else {
      struct =  this.parse_doxy(entity_file,"entity");
      struct =  this.parse_mermaid(entity_file,"entity");
      struct =  this.parse_ports_group(struct);
      struct =  this.parse_virtual_bus(struct);
      struct.entity.description = this.normalize_description(struct.entity.description);
    }
    return struct;
  }

  async get_only_entity_name(code){
    if (this.loaded === false){
      return undefined;
    }
    let entity_declaration = this.get_entity_declaration(code);
    let entity_name = '';
    if (entity_declaration !== undefined && entity_declaration.entity !== undefined){
      entity_name = entity_declaration.entity.name;
    }
    return entity_name;
  }

  async get_only_package_name(code){
    if (this.loaded === false){
      return undefined;
    }
    let package_declaration = this.get_package_declaration(code);
    let package_name = '';
    if (package_declaration !== undefined && package_declaration.package !== undefined){
      package_name = package_declaration.package.name;
    }
    return package_name;
  }

  async get_entity_or_package_name(code){
    let entity_name = await this.get_only_entity_name(code);
    if (entity_name === undefined || entity_name === ''){
      let package_name = await this.get_only_package_name(code);
      return {name:package_name, type:'package'};
    }
    else{
      return {name:entity_name, type:'entity'};
    }
  }

  get_entity_file(code) {
    try {
      let code_lines = code.split('\n');

      let entity_declaration = this.get_entity_declaration(code);
      if (code_lines.length > 99999999999999) {
        let elements = {
          'lang': 'vhdl',
          'entity': entity_declaration.entity,
          'generics': entity_declaration.generics,
          'ports': entity_declaration.ports,
          'body': { 'processes': [], 'instantiations': [] },
          'declarations': {'types': [], 'signals': [],
          'constants': [], 'functions': []}
        };
        return elements;
      }
      else {
        let elements = {
          'lang': 'vhdl',
          'entity': entity_declaration.entity,
          'generics': entity_declaration.generics,
          'ports': entity_declaration.ports,
          'body': this.get_architecture_body_elements(code),
          'declarations': this.get_declaration_elements('arch', code)
        };
        return elements;
      }
    }
    catch (e) { return undefined; }
  }

  get_package_file(code) {
    try {
      let packge_declaration = this.get_package_declaration(code);
      let elements = {
        'lang': 'vhdl',
        'package': packge_declaration.package,
        'declarations': this.get_declaration_elements('package', code)
      };
      return elements;
    }
    catch (e) { return undefined; }
  }

  get_package_declaration(code) {
    let tree = this.parse(code);

    let description = '';
    let name = '';

    let break_p = false;
    let cursor = tree.walk();
    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'design_unit') {
        cursor.gotoFirstChild();
        do{
          if (cursor.nodeType === 'package_declaration') {
            cursor.gotoFirstChild();
            do {
              if (cursor.nodeType === 'identifier') {
                name = cursor.nodeText;
                break_p = true;
              }
            }
            while (cursor.gotoNextSibling() === true && break_p === false);
          }
          else if (cursor.nodeType === 'comment') {
            description += this.get_comment(cursor.nodeText);
          }
          else {
            description = '';
          }
        }
        while (cursor.gotoNextSibling() === true && break_p === false);
      }
      else if (cursor.nodeType === 'package_declaration'){
        cursor.gotoFirstChild();
        do {
          if (cursor.nodeType === 'identifier') {
            name = cursor.nodeText;
            break_p = true;
          }
        }
        while (cursor.gotoNextSibling() === true && break_p === false);
      }
    }
    while (cursor.gotoNextSibling() === true && break_p === false);
    let package_t = { 'name': name, 'description': description };
    return { 'package': package_t, };
  }

  get_entity_declaration(code) {
    let tree = this.parse(code);
    let entity_name = '';

    let description = this.get_entity_declaration_description(code);

    let break_p = false;
    let cursor = tree.walk();
    let result = {
      generics : [],
      ports: []
    };
    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'design_unit') {
        cursor.gotoFirstChild();
        do {
          if (cursor.nodeType === 'entity_declaration') {
            cursor.gotoFirstChild();
            do {
              if (cursor.nodeType === 'identifier') {
                entity_name = cursor.nodeText;
              }
              else if (cursor.nodeType === 'header') {
                result = this.get_generics_and_ports(cursor.currentNode());
              }
            }
            while (cursor.gotoNextSibling() === true && break_p === false);
          }
        }
        while (cursor.gotoNextSibling() === true && break_p === false);
      }
    }
    while (cursor.gotoNextSibling() === true && break_p === false);
    let entity = { 'name': entity_name, 'description': description };
    return { 'entity': entity, 'generics': result.generics, 'ports': result.ports };
  }

  get_entity_declaration_description(code) {
    let tree = this.parse(code);

    let entity_description = '';

    let break_p = false;
    let cursor = tree.walk();
    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'design_unit') {
        cursor.gotoFirstChild();
        do {
          if (cursor.nodeType === 'entity_declaration') {
          }
          else if (cursor.nodeType === 'comment') {
            entity_description += this.get_comment(cursor.nodeText);
          }
        }
        while (cursor.gotoNextSibling() === true && break_p === false);
      }
      else if (cursor.nodeType === 'comment') {
        entity_description += this.get_comment(cursor.nodeText);
      }
      else {
        entity_description = '';
      }
    }
    while (cursor.gotoNextSibling() === true && break_p === false);
    return entity_description;
  }

  get_generics_and_ports(p) {
    let generics = [];
    let ports = [];
    let break_p = false;
    let cursor = p.walk();
    cursor.gotoFirstChild();

    do {
      if (cursor.nodeType === 'generic_clause') {
        generics = this.get_generics_or_ports(cursor.currentNode());
      }
      else if (cursor.nodeType === 'port_clause') {
        ports = this.get_generics_or_ports(cursor.currentNode());
      }
    }
    while (cursor.gotoNextSibling() === true && break_p === false);
    return { 'generics': generics, 'ports': ports };
  }

  get_generics_or_ports(p) {
    let break_p = false;
    let elements_array = [];

    let cursor = p.walk();
    let comments = '';

    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'interface_constant_declaration') {
        let elements = this.get_element(cursor.currentNode());
        for (let i = 0; i < elements.length; ++i) {
          elements[i].description = comments;
          elements_array.push(elements[i]);
        }
        comments = '';
      }
      else if (cursor.nodeType === 'interface_signal_declaration') {
        let elements = this.get_element(cursor.currentNode());
        for (let i = 0; i < elements.length; ++i) {
          elements[i].description = comments;
          elements_array.push(elements[i]);
        }
        comments = '';
      }
      else if (cursor.nodeType === 'comment') {
        let txt_comment = cursor.nodeText.slice(2);
        let comment_line = cursor.startPosition.row;
        if (txt_comment[0] === this.comment_symbol || this.comment_symbol === '') {
          if (txt_comment.charAt(txt_comment.length - 1) === '\n'
            || txt_comment.charAt(txt_comment.length - 1) === '\r') {
            txt_comment = txt_comment.slice(0, -1);
          }
          let check = false;
          //Constants
          for (let i = 0; i < elements_array.length; ++i) {
            if (comment_line === elements_array[i].line) {
              if (this.comment_symbol === ''){
                elements_array[i].description = txt_comment;
              }
              else{
                elements_array[i].description = txt_comment.slice(1);
              }
              check = true;
            }
          } 
          if (check === false) {
            comments += txt_comment.slice(1)+"\n";
          }
        }
      }
      else {
        comments = '';
      }
    } while (cursor.gotoNextSibling() === true && break_p === false);
    return elements_array;
  }

  get_element(p) {
    let break_p = false;
    let line = undefined;
    let elements_array = [];
    let cursor = p.walk();
    let identifiers = [];
    let type = '';
    let direction = '';
    let default_value = '';

    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'identifier_list') {
        identifiers = this.get_identifier_of_list(cursor.currentNode());
        line = cursor.startPosition.row;
      }
      else if (cursor.nodeType === 'subtype_indication') {
        type = cursor.nodeText;
      }
      else if (cursor.nodeType === 'mode') {
        direction = cursor.nodeText;
      }
      else if (cursor.nodeType === 'default_expression') {
        let normalized_value = cursor.nodeText;
        normalized_value = normalized_value.replace(':=', '');
        normalized_value = normalized_value.replace(': =', '');
        default_value = normalized_value.trim();
      }
    }
    while (cursor.gotoNextSibling() === true && break_p === false);

    if (direction === undefined) {
      direction = '';
    }
    for (let i = 0; i < identifiers.length; ++i) {
      let element = {
        'name': identifiers[i],
        'type': type,
        'line': line,
        'direction': direction.toLocaleLowerCase(),
        'default_value': default_value
      };
      elements_array.push(element);
    }
    return elements_array;
  }

  get_identifier_of_list(p) {
    let break_p = false;
    let identifiers = [];
    let cursor = p.walk();

    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'identifier') {
        identifiers.push(cursor.nodeText);
      }
    }
    while (cursor.gotoNextSibling() === true && break_p === false);
    return identifiers;
  }

  get_architecture_body(code) {
    let tree = this.parse(code);

    let break_p = false;
    let counter = 0;
    let arch_body = undefined;
    let cursor = tree.walk();
    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'design_unit') {
        counter += 1;
        if (counter === 2) {
          cursor.gotoFirstChild();
          do {
            if (cursor.nodeType === 'architecture_body') {
              cursor.gotoFirstChild();
              do {
                if (cursor.nodeType === 'concurrent_statement_part') {
                  arch_body = cursor.currentNode();
                  break_p = true;
                }
              }
              while (cursor.gotoNextSibling() === true && break_p === false);
            }
          }
          while (cursor.gotoNextSibling() === true && break_p === false);
        }
      }
    }
    while (cursor.gotoNextSibling() === true && break_p === false);
    return arch_body;
  }


  get_architecture_body_elements(code) {
    try {
      let arch_body = this.get_architecture_body(code);
      let process_array = [];
      let instanciation_array = [];

      let cursor = arch_body.walk();
      let comments = '';

      cursor.gotoFirstChild();
      do {
        if (cursor.nodeType === 'component_instantiation_statement') {
          let elements = this.get_instantiation(cursor.currentNode());
          for (let i = 0; i < elements.length; ++i) {
            elements[i].description = comments;
            instanciation_array.push(elements[i]);
          }
          comments = '';
        }
        else if (cursor.nodeType === 'process_statement') {
          let elements = this.get_process(cursor.currentNode());
          for (let i = 0; i < elements.length; ++i) {
            elements[i].description = comments.replace('fsm_extract', '');
            process_array.push(elements[i]);
          }
          comments = '';
        }
        else if (cursor.nodeType === 'comment') {
          comments += this.get_comment(cursor.nodeText);
        }
        else {
          comments = '';
        }
      }
      while (cursor.gotoNextSibling() !== false);
      return { 'processes': process_array, 'instantiations': instanciation_array };
    }
    catch (e) {
      return { 'processes': [], 'instantiations': [] };
    }
  }

  get_process(p) {
    let elements = [];
    let name = '';
    let element = {
      'name': '',
      'type': '',
      'sens_list': ''
    };
    let break_p = false;
    let cursor = p.walk();
    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'label') {
        name = cursor.nodeText.replace(':', '').trim();
      }
      else if (cursor.nodeType === 'sensitivity_list') {
        element.sens_list = cursor.nodeText.trim();
      }
    }
    while (cursor.gotoNextSibling() === true && break_p === false);
    if (name === '') {
      element.name = 'unnamed';
    }
    else {
      element.name = name;
    }
    elements.push(element);
    return elements;
  }

  get_instantiation(p) {
    let elements = [];
    let name = '';
    let element = {
      'name': '',
      'type': ''
    };
    let break_p = false;
    let cursor = p.walk();
    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'label') {
        name = cursor.nodeText.replace(':', '').trim();
      }
      else if (cursor.nodeType === 'component_instantiation') {
        element.type = cursor.nodeText;
      }
      else if (cursor.nodeType === 'entity_instantiation') {
        const regex = /entity+[ \t]/gi;
        element.type = cursor.nodeText.replace(regex, '');
      }
    }
    while (cursor.gotoNextSibling() === true && break_p === false);
    if (name === '') {
      element.name = 'unnamed';
    }
    else {
      element.name = name;
    }
    elements.push(element);
    return elements;
  }


  get_architecture_declaration(code) {
    let tree = this.parse(code);

    let break_p = false;
    let counter = 0;
    let arch_declaration = undefined;
    let cursor = tree.walk();
    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'design_unit') {
        counter += 1;
        if (counter === 2) {
          cursor.gotoFirstChild();
          do {
            if (cursor.nodeType === 'architecture_body') {
              cursor.gotoFirstChild();
              do {
                if (cursor.nodeType === 'declarative_part') {
                  arch_declaration = cursor.currentNode();
                  break_p = true;
                }
              }
              while (cursor.gotoNextSibling() === true && break_p === false);
            }
          }
          while (cursor.gotoNextSibling() === true && break_p === false);
        }
      }
    }
    while (cursor.gotoNextSibling() === true && break_p === false);
    return arch_declaration;
  }

  get_package_top_declaration(code) {
    let tree = this.parse(code);

    let declaration = undefined;

    let break_p = false;
    let cursor = tree.walk();
    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'design_unit') {
        cursor.gotoFirstChild();
        do{
          if (cursor.nodeType === 'package_declaration') {
            cursor.gotoFirstChild();
            do {
              if (cursor.nodeType === 'declarative_part') {
                declaration = cursor.currentNode();
                break_p = true;
              }
            }
            while (cursor.gotoNextSibling() === true && break_p === false);
          }
        }
        while (cursor.gotoNextSibling() === true && break_p === false);
      }
      else if (cursor.nodeType === 'package_declaration'){
        cursor.gotoFirstChild();
        do {
          if (cursor.nodeType === 'declarative_part') {
            declaration = cursor.currentNode();
            break_p = true;
          }
        }
        while (cursor.gotoNextSibling() === true && break_p === false);
      }
    }
    while (cursor.gotoNextSibling() === true && break_p === false);
    return declaration;
  }

  get_declaration_elements(type, code) {
    let top_declaration;
    if (type === 'arch') {
      top_declaration = this.get_architecture_declaration(code);
    }
    else {
      top_declaration = this.get_package_top_declaration(code);
    }
    let types_array = [];
    let signals_array = [];
    let constants_array = [];
    let functions_array = [];

    if (top_declaration === undefined) {
      return {
        'types': types_array, 'signals': signals_array,
        'constants': constants_array, 'functions': functions_array
      };
    }

    let cursor = top_declaration.walk();
    let comments = '';

    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'full_type_declaration') {
        let elements = this.get_full_type_declaration(cursor.currentNode());
        for (let i = 0; i < elements.length; ++i) {
          elements[i].description = comments;
          types_array.push(elements[i]);
        }
        comments = '';
      }
      else if (cursor.nodeType === 'signal_declaration') {
        let elements = this.get_signal_declaration(cursor.currentNode());
        for (let i = 0; i < elements.length; ++i) {
          elements[i].description = comments;
          signals_array.push(elements[i]);
        }
        comments = '';
      }
      else if (cursor.nodeType === 'subprogram_body' || cursor.nodeType === 'subprogram_declaration') {
        let elements = this.get_function_body(cursor.currentNode());
        for (let i = 0; i < elements.length; ++i) {
          elements[i].description = comments;
          functions_array.push(elements[i]);
        }
        comments = '';
      }
      else if (cursor.nodeType === 'constant_declaration') {
        let elements = this.get_constant_declaration(cursor.currentNode());
        for (let i = 0; i < elements.length; ++i) {
          elements[i].description = comments;
          constants_array.push(elements[i]);
        }
        comments = '';
      }
      else if (cursor.nodeType === 'comment') {
        let txt_comment = cursor.nodeText.slice(2);
        if (txt_comment.charAt(txt_comment.length - 1) === '\n'
          || txt_comment.charAt(txt_comment.length - 1) === '\r') {
          txt_comment = txt_comment.slice(0, -1);
        }

        let comment_line = cursor.startPosition.row;
        if (txt_comment[0] === this.comment_symbol || this.comment_symbol === '') {
          if (this.comment_symbol !== ''){
            txt_comment = txt_comment.slice(1);
          }

          let check = false;
          //Types
          for (let i = 0; i < types_array.length; ++i) {
            if (comment_line === types_array[i].line) {
              types_array[i].description = txt_comment;
              check = true;
            }
          }
          //Signals
          for (let i = 0; i < signals_array.length; ++i) {
            if (comment_line === signals_array[i].line) {
              signals_array[i].description = txt_comment;
              check = true;
            }
          }
          //Constants
          for (let i = 0; i < constants_array.length; ++i) {
            if (comment_line === constants_array[i].line) {
              constants_array[i].description = txt_comment;
              check = true;
            }
          }
          //Functions
          for (let i = 0; i < functions_array.length; ++i) {
            if (comment_line === functions_array[i].line) {
              functions_array[i].description = txt_comment;
              check = true;
            }
          }
          if (check === false) {
            comments += txt_comment + "\n";
          }
        }
        else {
          comments = '';
        }
      }
      else {
        comments = '';
      }
    }
    while (cursor.gotoNextSibling() !== false);
    return {
      'types': types_array, 'signals': signals_array,
      'constants': constants_array, 'functions': functions_array
    };
  }

  remove_comments(str){
    let str_split = str.split('\n');
    let str_not_comments = '';
    for (let i = 0; i < str_split.length; i++) {
      let element = str_split[i];
      element = element.trim();
      if (element[0] !== '-' && element[1] !== '-'){
        str_not_comments += element + '\n';
      }
    }
    return str_not_comments;
  }

  remove_break_line(str){
    let str_out = str.replace(/(\r\n|\n|\r)/gm, " ");
    return str_out;
  }

  get_function_body(p) {
    let element = {
      'name': '',
      'line': 0,
      'type': '',
      'arguments': '',
      'return': ''
    };
    let break_p = false;
    let cursor = p.walk();
    element.line = cursor.startPosition.row;
    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'pure_function_specification' || cursor.nodeType === 'procedure_specification') {
        cursor.gotoFirstChild();
        do {
          if (cursor.nodeType === 'identifier') {
            element.name = cursor.nodeText;
          }
          else if (cursor.nodeType === 'formal_procedure_parameter_clause' || 
                cursor.nodeType === 'formal_function_parameter_clause'){
            let return_arguments = cursor.nodeText;
            element.arguments = this.remove_break_line(this.remove_comments(return_arguments));
          }
          else if (cursor.nodeType === 'return'){
            let return_definitions = cursor.nodeText;
            element.return = this.remove_break_line(this.remove_comments(return_definitions));
          }
        }
        while (cursor.gotoNextSibling() === true && break_p === false);
      }
    }
    while (cursor.gotoNextSibling() === true && break_p === false);
    return [element];
  }


  get_full_type_declaration(p) {
    let elements = [];
    let element = {
      'name': '',
      'type': '',
      'line': 0
    };
    let break_p = false;
    let cursor = p.walk();
    element.line = cursor.startPosition.row;
    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'identifier') {
        element.name = cursor.nodeText;
      }
      else if (cursor.nodeType === 'enumeration_type_definition') {
        let type_definition = cursor.nodeText;
        element.type = this.remove_break_line(this.remove_comments(type_definition));
      }
      else if (cursor.nodeType === 'unbounded_array_definition') {
        let type_definition = cursor.nodeText;
        element.type = this.remove_break_line(this.remove_comments(type_definition));
      }
    }
    while (cursor.gotoNextSibling() === true && break_p === false);
    elements.push(element);
    return elements;
  }

  get_signal_declaration(p) {
    let elements = [];
    let break_p = false;
    let cursor = p.walk();
    let line = cursor.startPosition.row;
    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'identifier_list') {
        let names = cursor.nodeText.split(',');
        for (let i = 0; i < names.length; ++i) {
          let element = {
            'name': names[i],
            'type': '',
            'line': line
          };
          elements.push(element);
        }
      }
      else if (cursor.nodeType === 'subtype_indication') {
        for (let i = 0; i < elements.length; ++i) {
          elements[i].type = cursor.nodeText;
        }
      }
    }
    while (cursor.gotoNextSibling() === true && break_p === false);
    return elements;
  }

  get_constant_declaration(p) {
    let elements = [];
    let break_p = false;
    let cursor = p.walk();
    let line = cursor.startPosition.row;
    cursor.gotoFirstChild();
    do {
      if (cursor.nodeType === 'identifier_list') {
        let names = cursor.nodeText.split(',');
        for (let i = 0; i < names.length; ++i) {
          let element = {
            'name': names[i],
            'type': '',
            'default_value': '',
            'line': line
          };
          elements.push(element);
        }
      }
      else if (cursor.nodeType === 'subtype_indication') {
        for (let i = 0; i < elements.length; ++i) {
          elements[i].type = cursor.nodeText;
        }
      }
      else if (cursor.nodeType === 'default_expression') {
        let normalized_value = cursor.nodeText;
        normalized_value = normalized_value.replace(':=', '');
        normalized_value = normalized_value.replace(': =', '');
        for (let i = 0; i < elements.length; ++i) {
          elements[i].default_value = normalized_value;
        }
      }
    }
    while (cursor.gotoNextSibling() === true && break_p === false);
    return elements;
  }
}

module.exports = {
  Parser: Parser
};
