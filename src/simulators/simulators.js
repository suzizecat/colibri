const axios = require("axios");
const Codes = require('./codes')

class Simulators {
  constructor(ip,port){
    this.url = 'http://'+ip+":"+port;
  }

  async getSuites(ip,port){
    var rsp = {result:null,data:null};
    const url = this.url+'/suites/';
    const getData = async url => {
      try {
        const response = await axios.get(url);
        rsp['result'] = Codes.CODE_RESPONSE['SUCCESSFUL'];
        rsp['data']   = response.data;
        return await rsp;
      } catch (error) {
        console.log(error);
        rsp['result'] = Codes.CODE_RESPONSE['UNREACHABLE_SERVER'];
        return await rsp;
      }
    };
    return await getData(url);
  }

  async simulate(project){
    const url = this.url+'/tests/';
    const getData = async url => {
      try {
        const response = await axios.post(url,project);
        return response.data;
      } catch (error) {
        console.log(error);
      }
    };
    return await getData(url);
  }

  // async runTool(project){
  //   const url = this.url+'/tests/';
  //   const getData = async url => {
  //     try {
  //       const response = await axios.post(url,project);
  //       return response.data;
  //     } catch (error) {
  //       console.log(error);
  //     }
  //   };
  //   return await getData(url);
  // }
  //
  // async runCocotb(project){
  //   const url = this.url+'/tests/';
  //   const getData = async url => {
  //     try {
  //       const response = await axios.post(url,project);
  //       return response.data;
  //     } catch (error) {
  //       console.log(error);
  //     }
  //   };
  //   return await getData(url);
  // }
  //
  // async runEdalize(project){
  //   const url = this.url+'/tests/';
  //   const getData = async url => {
  //     try {
  //       const response = await axios.post(url,project);
  //       return response.data;
  //     } catch (error) {
  //       console.log(error);
  //     }
  //   };
  //   return await getData(url);
  // }
}

module.exports = {
  Codes : Codes,
  Simulators : Simulators
}
