/*
 * Definition_Manager
 */
import AB from "@digiserve/ab-utils";
const env = AB.defaults.env;

export default {
   definition_manager: {
      /*************************************************************************/
      /* enable: {bool} is this service active?                                */
      /*************************************************************************/
      enable: env("DEFINITION_MANAGER_ENABLE", true),
   },

   /**
    * datastores:
    * Sails style DB connection settings
    */
   datastores: AB.defaults.datastores(),
};
