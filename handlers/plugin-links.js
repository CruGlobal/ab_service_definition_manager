/**
 * plugin-links
 * Return all the SITE_PLUGIN_LINK for a given condition.
 */

const getPluginLinks = require("../AppBuilder/queries/allPluginLinks.js");

module.exports = {
   /**
    * Key: the cote message key we respond to.
    */
   key: "definition_manager.plugin-links",

   /**
    * inputValidation
    * define the expected inputs to this service handler:
    * Format:
    * "parameterName" : {
    *    {joi.fn}   : {bool},  // performs: joi.{fn}();
    *    {joi.fn}   : {
    *       {joi.fn1} : true,   // performs: joi.{fn}().{fn1}();
    *       {joi.fn2} : { options } // performs: joi.{fn}().{fn2}({options})
    *    }
    *    // examples:
    *    "required" : {bool},  // default = false
    *
    *    // custom:
    *        "validation" : {fn} a function(value, {allValues hash}) that
    *                       returns { error:{null || {new Error("Error Message")} }, value: {normalize(value)}}
    * }
    */
   inputValidation: {
      cond: { object: true, required: true },
   },

   /**
    * fn
    * our Request handler.
    * @param {obj} req
    *        the request object sent by the api_sails/api/controllers/definition_manager/find.
    * @param {fn} cb
    *        a node style callback(err, results) to send data when job is finished
    */
   fn: async function handler(req, cb) {
      const cond = req.param("cond");

      try {
         let pluginLinks = await getPluginLinks(req, cond);
         cb(null, pluginLinks);
      } catch (error) {
         req.log(error);
         cb(error);
      }
   },
};
