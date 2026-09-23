/**
 * Handler
 * test the interface for our default service handler.
 */
import _ from "lodash";
import { expect } from "chai";

// Base config value.
import defaultConfig from "../../config/definition_manager.js";

// Our service handler:
import Handler from "../../src/handler.js";

describe("definition_manager: handler", function () {
   // Check for proper initialization
   describe("-> missing config", function () {
      it("should return an error when receiving a job request #missingconfig ", function (done) {
         Handler.init(null); // clear the config in case it is already set
         var request = {};
         Handler.fn(request, (err, response) => {
            expect(err).to.exist;
            expect(err).to.have.property("code", "EMISSINGCONFIG");
            expect(response).to.not.exist;
            done();
         });
      });
   });

   // handle a disabled state:
   describe("-> disabled ", function () {
      var disabledConfig = _.cloneDeep(defaultConfig);
      disabledConfig.enable = false;

      it("should return an error when receiving a job request #disabled ", function (done) {
         Handler.init({ config: disabledConfig });
         var request = {};
         Handler.fn(request, (err, response) => {
            expect(err).to.have.property("code", "EDISABLED");
            expect(response).to.not.exist;
            done();
         });
      });
   });
});
