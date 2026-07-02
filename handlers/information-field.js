/**
 * information-field
 * our Request handler.
 */

const ABBootstrap = require("../AppBuilder/ABBootstrap");

module.exports = {
   /**
    * Key: the cote message key we respond to.
    */
   key: "definition_manager.information-field",

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
    *    "required" : {bool},
    *    "optional" : {bool},
    *
    *    // custom:
    *        "validation" : {fn} a function(value, {allValues hash}) that
    *                       returns { error:{null || {new Error("Error Message")} }, value: {normalize(value)}}
    * }
    */
   inputValidation: {
      objID: { string: { uuid: true }, required: true },
      ID: { string: { uuid: true }, required: true },
   },

   /**
    * fn
    * our Request handler.
    * @param {obj} req
    *        the request object sent by the
    *        api_sails/api/controllers/definition_manager/information-field.
    * @param {fn} cb
    *        a node style callback(err, results) to send data when job is finished
    */
   fn: function handler(req, cb, manualReset = false) {
      req.log("definition_manager.information-field:");

      // get the AB for the current tenant
      ABBootstrap.init(req)
         .then(async (AB) => {
            const objID = req.param("objID");
            const fieldID = req.param("ID");

            const object = AB.objectByID(objID);
            if (!object) {
               if (manualReset) {
                  const err = new Error(`ABObject not found for [${objID}]`);
                  err.code = 404;
                  return cb(err);
               }
               // attempt a single manual Reset of the definitions:
               req.log("::: MANUAL RESET DEFINITIONS :::");
               ABBootstrap.resetDefinitions(req);
               return handler(req, cb, true);
            }

            const field = object.fieldByID(fieldID);
            if (!field) {
               if (manualReset) {
                  const err = new Error(`ABField not found for [${fieldID}]`);
                  err.code = 404;
                  return cb(err);
               }
               // attempt a single manual Reset of the definitions:
               req.log("::: MANUAL RESET DEFINITIONS :::");
               ABBootstrap.resetDefinitions(req);
               return handler(req, cb, true);
            }

            const dbConn = AB.Knex.connection();

            req.log(
               `Getting Information... Object[${object.id}], Field[${field.id}]`
            );

            try {
               const rows = (
                  await dbConn.raw(
                     `SHOW COLUMNS FROM \`${object.tableName}\` WHERE \`Field\` = '${field.columnName}'`
                  )
               )?.[0];
               cb(null, rows?.[0]);
            } catch (err) {
               req.notify.developer(err, {
                  context: `Service:definition_manager.information-field: Error getting the field information. - Object[${objID}], Field[${fieldID}]`,
               });
               cb(err);
            }
         })
         .catch((err) => {
            req.notify.developer(err, {
               context:
                  "Service:definition_manager.information-field: Error initializing ABFactory",
            });
            cb(err);
         });
   },
};
