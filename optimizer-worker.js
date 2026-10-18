import { suggestions } from './core.js';
self.onmessage = ({data}) => {
  try { self.postMessage({key:data.key,result:suggestions(data.day,data.foods)}); }
  catch(error) { self.postMessage({key:data.key,error:error.message}); }
};
