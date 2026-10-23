// Match the expression functions registered by the actual tracker app.
const vega=require('./vega');
require('./text-wrap').register(vega);
vega.expressionFunction('trackerHierarchyCounts',require('./hierarchy-navigation').counts);
module.exports=vega;
