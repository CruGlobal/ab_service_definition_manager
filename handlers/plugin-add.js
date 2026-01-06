/**
 * plugin-add
 * Process a request to add a Plugin to the ABFactory for this tenant.
 */

const ABBootstrap = require("../AppBuilder/ABBootstrap");
// {ABBootstrap}
// responsible for initializing and returning an {ABFactory} that will work
// with the current tenant for the incoming request.
const { URL } = require("url");

module.exports = {
   /**
    * Key: the cote message key we respond to.
    */
   key: "definition_manager.plugin-add",

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
      url: { string: true, required: true },
   },

   /**
    * fn
    * our Request handler.
    * @param {obj} req
    *        the request object sent by the
    *        api_sails/api/controllers/definition_manager/definition-create.
    * @param {fn} cb
    *        a node style callback(err, results) to send data when job is finished
    */
   fn: async function handler(req, cb) {
      req.log("definition_manager.plugin-add:");

      // get the AB for the current tenant
      try {
         let AB = await ABBootstrap.init(req); // eslint-disable-line no-unused-vars

         let urlInput = req.param("url");
         let manifestUrl;
         let owner, repo, branch;
         let isLocalPath = false;

         // Check if URL has a protocol (http:// or https://)
         // If not, treat it as a local development server path
         if (!urlInput.match(/^https?:\/\//i)) {
            // Local development server path
            // Ensure path starts with /
            const localPath = urlInput.startsWith("/")
               ? urlInput
               : `/${urlInput}`;
            // Construct URL to web service: http://web:80/path/manifest.json
            manifestUrl = `http://web:80/assets/ab_plugins${localPath}/manifest.json`;
            isLocalPath = true;
            req.log(`Treating as local path, fetching from: ${manifestUrl}`);
         } else {
            // GitHub URL - parse to extract owner, repo, and branch
            // Supports formats like:
            // - https://github.com/owner/repo
            // - https://github.com/owner/repo.git
            // - https://github.com/owner/repo/tree/branch
            try {
               const url = new URL(urlInput);
               const pathParts = url.pathname.split("/").filter((p) => p);

               if (pathParts.length < 2) {
                  throw new Error(
                     "Invalid GitHub URL format. Expected: https://github.com/owner/repo"
                  );
               }

               owner = pathParts[0];
               repo = pathParts[1].replace(/\.git$/, ""); // Remove .git if present
               branch = "main";

               // Check if branch is specified in URL (e.g., /tree/branch-name)
               if (pathParts.length >= 3 && pathParts[2] === "tree") {
                  branch = pathParts[3] || "main";
               }

               // Construct raw GitHub URL for manifest.json
               manifestUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/manifest.json`;
               req.log(`Treating as GitHub URL, fetching from: ${manifestUrl}`);
            } catch (urlError) {
               throw new Error(
                  `Failed to parse GitHub URL: ${urlError.message}`
               );
            }
         }

         // Fetch manifest.json
         // fetch automatically handles redirects and is cleaner than https
         const response = await fetch(manifestUrl);

         if (!response.ok) {
            throw new Error(
               `Failed to fetch manifest.json (${manifestUrl}): HTTP ${response.status} ${response.statusText}`
            );
         }

         const manifest = await response.json();

         req.log("Successfully fetched manifest.json:", manifest);

         const Plugins = AB.objectPlugin();
         const PluginLinks = AB.objectPluginLinks();

         try {
            // Check if a plugin with the same URL already exists
            let existingPlugins = await req.retry(() =>
               Plugins.model().find({
                  where: {
                     url: manifestUrl,
                  },
               })
            );

            let plugin;
            let existingPlugin =
               existingPlugins && existingPlugins.length > 0
                  ? existingPlugins[0]
                  : null;
            if (existingPlugin) {
               // Update existing plugin
               req.log("Updating existing plugin:", existingPlugin.uuid);
               plugin = await req.retry(() =>
                  Plugins.model().update(
                     { uuid: existingPlugin.uuid },
                     {
                        Name: manifest.name,
                        Description: manifest.description,
                        icon: manifest.icon,
                        version: manifest.version,
                     }
                  )
               );
            } else {
               // Create new plugin
               req.log("Creating new plugin");
               plugin = await req.retry(() =>
                  Plugins.model().create({
                     Name: manifest.name,
                     Description: manifest.description,
                     url: manifestUrl,
                     icon: manifest.icon,
                     version: manifest.version,
                  })
               );
            }

            // Get existing plugin links
            const existingLinks = await req.retry(() =>
               PluginLinks.model().find({
                  where: {
                     plugin: plugin.uuid,
                  },
               })
            );

            // Create a map of existing links by platform+type for quick lookup
            // We'll use a combination that should be unique per manifest entry
            const existingLinksMap = new Map();
            existingLinks.forEach((link) => {
               // Use platform+type as key, or URL if that's more reliable
               const key = `${link.platform || ""}_${link.type || ""}`;
               existingLinksMap.set(key, link);
            });

            // Determine plugin root path
            let pluginRoot;
            if (isLocalPath) {
               // Local development: pluginroot is /assets/ab_plugins{localPath}
               const localPath = urlInput.startsWith("/")
                  ? urlInput
                  : `/${urlInput}`;
               pluginRoot = `/assets/ab_plugins${localPath}`;
            } else {
               // Published plugin: pluginroot is the manifestUrl without /manifest.json
               // Files will be in pluginroot/dist/ folder
               pluginRoot = manifestUrl.replace(/\/manifest\.json$/, "");
            }

            // Process each plugin entry from the manifest
            const manifestLinkKeys = new Set();
            const linkOperations = [];

            for (const pluginEntry of manifest.plugins) {
               // Determine the folder (dev for local, dist for published)
               const folder = isLocalPath ? "dev" : "dist";

               // Get the file path from the manifest (e.g., "./ABObjectNetsuiteAPI_service.js")
               // Remove leading "./" if present
               const filePath = pluginEntry.path.replace(/^\.\//, "");

               // Construct the base URL path
               const basePath = `${pluginRoot}/${folder}/${filePath}`;

               // Transform URL based on platform and whether it's local development
               let finalUrl;
               if (isLocalPath) {
                  // Local development
                  if (pluginEntry.platform === "service") {
                     // Service platform: include http://web:80
                     finalUrl = `http://web:80${basePath}`;
                  } else {
                     // Web platform: just the path starting with /assets/...
                     finalUrl = basePath;
                  }
               } else {
                  // Published plugin: pluginRoot is already a full URL (GitHub)
                  // Files are in pluginroot/dist/ folder
                  // Use the basePath directly (already includes the full GitHub URL)
                  finalUrl = basePath;
               }

               // Add cache busting for web-based links
               if (pluginEntry.platform === "web") {
                  const separator = finalUrl.includes("?") ? "&" : "?";
                  const timestamp = new Date(plugin.updated_at).getTime();
                  finalUrl = `${finalUrl}${separator}v=${timestamp}`;
               }

               // Create a key to identify this link
               const linkKey = `${pluginEntry.platform || ""}_${
                  pluginEntry.type || ""
               }`;
               manifestLinkKeys.add(linkKey);

               // Check if this link already exists
               const existingLink = existingLinksMap.get(linkKey);

               if (existingLink) {
                  // Update existing link if URL has changed
                  if (existingLink.url !== finalUrl) {
                     req.log(`Updating plugin link: ${linkKey} - URL changed`);
                     linkOperations.push(
                        req.retry(() =>
                           PluginLinks.model().update(
                              { uuid: existingLink.uuid },
                              {
                                 url: finalUrl,
                                 platform: pluginEntry.platform,
                                 type: pluginEntry.type,
                              }
                           )
                        )
                     );
                  }
               } else {
                  // Create new link
                  req.log(`Creating new plugin link: ${linkKey}`);
                  linkOperations.push(
                     req.retry(() =>
                        PluginLinks.model().create({
                           plugin: plugin.uuid,
                           url: finalUrl,
                           platform: pluginEntry.platform,
                           type: pluginEntry.type,
                        })
                     )
                  );
               }
            }

            // Remove links that are in DB but not in manifest
            for (const existingLink of existingLinks) {
               const linkKey = `${existingLink.platform || ""}_${
                  existingLink.type || ""
               }`;
               if (!manifestLinkKeys.has(linkKey)) {
                  req.log(`Removing plugin link: ${linkKey} - not in manifest`);
                  linkOperations.push(
                     req.retry(() =>
                        PluginLinks.model().destroy({ uuid: existingLink.uuid })
                     )
                  );
               }
            }

            // Execute all link operations
            await Promise.all(linkOperations);

            // now return an instance of the plugin record
            let pluginRecord = await req.retry(() =>
               Plugins.model().find({
                  where: {
                     uuid: plugin.uuid,
                  },
                  populate: true,
               })
            );
            if (!pluginRecord) {
               throw new Error(`Failed to find plugin record: ${plugin.uuid}`);
            }

            cb(null, pluginRecord);
         } catch (error) {
            throw new Error(`Failed to create plugin: ${error.message}`);
         }
      } catch (err) {
         req.notify.developer(err, {
            context:
               "Service:definition_manager.plugin-add: Error processing plugin",
         });
         cb(err);
      }
   },
};
