"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/csp-report/route";
exports.ids = ["app/api/csp-report/route"];
exports.modules = {

/***/ "../../client/components/request-async-storage.external":
/*!********************************************************************************!*\
  !*** external "next/dist/client/components/request-async-storage.external.js" ***!
  \********************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/request-async-storage.external.js");

/***/ }),

/***/ "../../client/components/static-generation-async-storage.external":
/*!******************************************************************************************!*\
  !*** external "next/dist/client/components/static-generation-async-storage.external.js" ***!
  \******************************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/client/components/static-generation-async-storage.external.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "(rsc)/../../node_modules/.pnpm/next@15.0.0-canary.36_react-dom@19.0.0-rc.0_react@19.0.0-rc.0/node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fcsp-report%2Froute&page=%2Fapi%2Fcsp-report%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fcsp-report%2Froute.ts&appDir=%2FUsers%2Fhaydenfarquhar%2FProjects%2Ftorvus-console%2Fapps%2Fconsole%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fhaydenfarquhar%2FProjects%2Ftorvus-console%2Fapps%2Fconsole&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!*******************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ../../node_modules/.pnpm/next@15.0.0-canary.36_react-dom@19.0.0-rc.0_react@19.0.0-rc.0/node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fcsp-report%2Froute&page=%2Fapi%2Fcsp-report%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fcsp-report%2Froute.ts&appDir=%2FUsers%2Fhaydenfarquhar%2FProjects%2Ftorvus-console%2Fapps%2Fconsole%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fhaydenfarquhar%2FProjects%2Ftorvus-console%2Fapps%2Fconsole&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \*******************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   requestAsyncStorage: () => (/* binding */ requestAsyncStorage),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   staticGenerationAsyncStorage: () => (/* binding */ staticGenerationAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/route-modules/app-route/module.compiled */ \"(rsc)/../../node_modules/.pnpm/next@15.0.0-canary.36_react-dom@19.0.0-rc.0_react@19.0.0-rc.0/node_modules/next/dist/server/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/route-kind */ \"(rsc)/../../node_modules/.pnpm/next@15.0.0-canary.36_react-dom@19.0.0-rc.0_react@19.0.0-rc.0/node_modules/next/dist/server/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/../../node_modules/.pnpm/next@15.0.0-canary.36_react-dom@19.0.0-rc.0_react@19.0.0-rc.0/node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _Users_haydenfarquhar_Projects_torvus_console_apps_console_app_api_csp_report_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/csp-report/route.ts */ \"(rsc)/./app/api/csp-report/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/csp-report/route\",\n        pathname: \"/api/csp-report\",\n        filename: \"route\",\n        bundlePath: \"app/api/csp-report/route\"\n    },\n    resolvedPagePath: \"/Users/haydenfarquhar/Projects/torvus-console/apps/console/app/api/csp-report/route.ts\",\n    nextConfigOutput,\n    userland: _Users_haydenfarquhar_Projects_torvus_console_apps_console_app_api_csp_report_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { requestAsyncStorage, staticGenerationAsyncStorage, serverHooks } = routeModule;\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        staticGenerationAsyncStorage,\n        requestAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL25leHRAMTUuMC4wLWNhbmFyeS4zNl9yZWFjdC1kb21AMTkuMC4wLXJjLjBfcmVhY3RAMTkuMC4wLXJjLjAvbm9kZV9tb2R1bGVzL25leHQvZGlzdC9idWlsZC93ZWJwYWNrL2xvYWRlcnMvbmV4dC1hcHAtbG9hZGVyLmpzP25hbWU9YXBwJTJGYXBpJTJGY3NwLXJlcG9ydCUyRnJvdXRlJnBhZ2U9JTJGYXBpJTJGY3NwLXJlcG9ydCUyRnJvdXRlJmFwcFBhdGhzPSZwYWdlUGF0aD1wcml2YXRlLW5leHQtYXBwLWRpciUyRmFwaSUyRmNzcC1yZXBvcnQlMkZyb3V0ZS50cyZhcHBEaXI9JTJGVXNlcnMlMkZoYXlkZW5mYXJxdWhhciUyRlByb2plY3RzJTJGdG9ydnVzLWNvbnNvbGUlMkZhcHBzJTJGY29uc29sZSUyRmFwcCZwYWdlRXh0ZW5zaW9ucz10c3gmcGFnZUV4dGVuc2lvbnM9dHMmcGFnZUV4dGVuc2lvbnM9anN4JnBhZ2VFeHRlbnNpb25zPWpzJnJvb3REaXI9JTJGVXNlcnMlMkZoYXlkZW5mYXJxdWhhciUyRlByb2plY3RzJTJGdG9ydnVzLWNvbnNvbGUlMkZhcHBzJTJGY29uc29sZSZpc0Rldj10cnVlJnRzY29uZmlnUGF0aD10c2NvbmZpZy5qc29uJmJhc2VQYXRoPSZhc3NldFByZWZpeD0mbmV4dENvbmZpZ091dHB1dD0mcHJlZmVycmVkUmVnaW9uPSZtaWRkbGV3YXJlQ29uZmlnPWUzMCUzRCEiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7QUFBK0Y7QUFDdkM7QUFDcUI7QUFDc0M7QUFDbkg7QUFDQTtBQUNBO0FBQ0Esd0JBQXdCLHlHQUFtQjtBQUMzQztBQUNBLGNBQWMsa0VBQVM7QUFDdkI7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTtBQUNBLFlBQVk7QUFDWixDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0EsUUFBUSxpRUFBaUU7QUFDekU7QUFDQSxXQUFXLDRFQUFXO0FBQ3RCO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDcUc7O0FBRXJHIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vQHRvcnZ1cy9jb25zb2xlLz81YWNmIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcFJvdXRlUm91dGVNb2R1bGUgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9yb3V0ZS1tb2R1bGVzL2FwcC1yb3V0ZS9tb2R1bGUuY29tcGlsZWRcIjtcbmltcG9ydCB7IFJvdXRlS2luZCB9IGZyb20gXCJuZXh0L2Rpc3Qvc2VydmVyL3JvdXRlLWtpbmRcIjtcbmltcG9ydCB7IHBhdGNoRmV0Y2ggYXMgX3BhdGNoRmV0Y2ggfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9saWIvcGF0Y2gtZmV0Y2hcIjtcbmltcG9ydCAqIGFzIHVzZXJsYW5kIGZyb20gXCIvVXNlcnMvaGF5ZGVuZmFycXVoYXIvUHJvamVjdHMvdG9ydnVzLWNvbnNvbGUvYXBwcy9jb25zb2xlL2FwcC9hcGkvY3NwLXJlcG9ydC9yb3V0ZS50c1wiO1xuLy8gV2UgaW5qZWN0IHRoZSBuZXh0Q29uZmlnT3V0cHV0IGhlcmUgc28gdGhhdCB3ZSBjYW4gdXNlIHRoZW0gaW4gdGhlIHJvdXRlXG4vLyBtb2R1bGUuXG5jb25zdCBuZXh0Q29uZmlnT3V0cHV0ID0gXCJcIlxuY29uc3Qgcm91dGVNb2R1bGUgPSBuZXcgQXBwUm91dGVSb3V0ZU1vZHVsZSh7XG4gICAgZGVmaW5pdGlvbjoge1xuICAgICAgICBraW5kOiBSb3V0ZUtpbmQuQVBQX1JPVVRFLFxuICAgICAgICBwYWdlOiBcIi9hcGkvY3NwLXJlcG9ydC9yb3V0ZVwiLFxuICAgICAgICBwYXRobmFtZTogXCIvYXBpL2NzcC1yZXBvcnRcIixcbiAgICAgICAgZmlsZW5hbWU6IFwicm91dGVcIixcbiAgICAgICAgYnVuZGxlUGF0aDogXCJhcHAvYXBpL2NzcC1yZXBvcnQvcm91dGVcIlxuICAgIH0sXG4gICAgcmVzb2x2ZWRQYWdlUGF0aDogXCIvVXNlcnMvaGF5ZGVuZmFycXVoYXIvUHJvamVjdHMvdG9ydnVzLWNvbnNvbGUvYXBwcy9jb25zb2xlL2FwcC9hcGkvY3NwLXJlcG9ydC9yb3V0ZS50c1wiLFxuICAgIG5leHRDb25maWdPdXRwdXQsXG4gICAgdXNlcmxhbmRcbn0pO1xuLy8gUHVsbCBvdXQgdGhlIGV4cG9ydHMgdGhhdCB3ZSBuZWVkIHRvIGV4cG9zZSBmcm9tIHRoZSBtb2R1bGUuIFRoaXMgc2hvdWxkXG4vLyBiZSBlbGltaW5hdGVkIHdoZW4gd2UndmUgbW92ZWQgdGhlIG90aGVyIHJvdXRlcyB0byB0aGUgbmV3IGZvcm1hdC4gVGhlc2Vcbi8vIGFyZSB1c2VkIHRvIGhvb2sgaW50byB0aGUgcm91dGUuXG5jb25zdCB7IHJlcXVlc3RBc3luY1N0b3JhZ2UsIHN0YXRpY0dlbmVyYXRpb25Bc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzIH0gPSByb3V0ZU1vZHVsZTtcbmZ1bmN0aW9uIHBhdGNoRmV0Y2goKSB7XG4gICAgcmV0dXJuIF9wYXRjaEZldGNoKHtcbiAgICAgICAgc3RhdGljR2VuZXJhdGlvbkFzeW5jU3RvcmFnZSxcbiAgICAgICAgcmVxdWVzdEFzeW5jU3RvcmFnZVxuICAgIH0pO1xufVxuZXhwb3J0IHsgcm91dGVNb2R1bGUsIHJlcXVlc3RBc3luY1N0b3JhZ2UsIHN0YXRpY0dlbmVyYXRpb25Bc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzLCBwYXRjaEZldGNoLCAgfTtcblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9YXBwLXJvdXRlLmpzLm1hcCJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/../../node_modules/.pnpm/next@15.0.0-canary.36_react-dom@19.0.0-rc.0_react@19.0.0-rc.0/node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fcsp-report%2Froute&page=%2Fapi%2Fcsp-report%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fcsp-report%2Froute.ts&appDir=%2FUsers%2Fhaydenfarquhar%2FProjects%2Ftorvus-console%2Fapps%2Fconsole%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fhaydenfarquhar%2FProjects%2Ftorvus-console%2Fapps%2Fconsole&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./app/api/csp-report/route.ts":
/*!*************************************!*\
  !*** ./app/api/csp-report/route.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   POST: () => (/* binding */ POST)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/../../node_modules/.pnpm/next@15.0.0-canary.36_react-dom@19.0.0-rc.0_react@19.0.0-rc.0/node_modules/next/dist/api/server.js\");\n\nasync function POST(request) {\n    try {\n        const report = await request.json();\n        console.warn('[csp-report]', JSON.stringify(report));\n    } catch (error) {\n        console.warn('[csp-report] failed to parse report body', error);\n    }\n    return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n        received: true\n    }, {\n        status: 200\n    });\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL2NzcC1yZXBvcnQvcm91dGUudHMiLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBMkM7QUFFcEMsZUFBZUMsS0FBS0MsT0FBZ0I7SUFDekMsSUFBSTtRQUNGLE1BQU1DLFNBQVMsTUFBTUQsUUFBUUUsSUFBSTtRQUNqQ0MsUUFBUUMsSUFBSSxDQUFDLGdCQUFnQkMsS0FBS0MsU0FBUyxDQUFDTDtJQUM5QyxFQUFFLE9BQU9NLE9BQU87UUFDZEosUUFBUUMsSUFBSSxDQUFDLDRDQUE0Q0c7SUFDM0Q7SUFFQSxPQUFPVCxxREFBWUEsQ0FBQ0ksSUFBSSxDQUFDO1FBQUVNLFVBQVU7SUFBSyxHQUFHO1FBQUVDLFFBQVE7SUFBSTtBQUM3RCIsInNvdXJjZXMiOlsid2VicGFjazovL0B0b3J2dXMvY29uc29sZS8uL2FwcC9hcGkvY3NwLXJlcG9ydC9yb3V0ZS50cz80NzNjIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE5leHRSZXNwb25zZSB9IGZyb20gJ25leHQvc2VydmVyJztcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIFBPU1QocmVxdWVzdDogUmVxdWVzdCkge1xuICB0cnkge1xuICAgIGNvbnN0IHJlcG9ydCA9IGF3YWl0IHJlcXVlc3QuanNvbigpO1xuICAgIGNvbnNvbGUud2FybignW2NzcC1yZXBvcnRdJywgSlNPTi5zdHJpbmdpZnkocmVwb3J0KSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS53YXJuKCdbY3NwLXJlcG9ydF0gZmFpbGVkIHRvIHBhcnNlIHJlcG9ydCBib2R5JywgZXJyb3IpO1xuICB9XG5cbiAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgcmVjZWl2ZWQ6IHRydWUgfSwgeyBzdGF0dXM6IDIwMCB9KTtcbn1cbiJdLCJuYW1lcyI6WyJOZXh0UmVzcG9uc2UiLCJQT1NUIiwicmVxdWVzdCIsInJlcG9ydCIsImpzb24iLCJjb25zb2xlIiwid2FybiIsIkpTT04iLCJzdHJpbmdpZnkiLCJlcnJvciIsInJlY2VpdmVkIiwic3RhdHVzIl0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./app/api/csp-report/route.ts\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next@15.0.0-canary.36_react-dom@19.0.0-rc.0_react@19.0.0-rc.0"], () => (__webpack_exec__("(rsc)/../../node_modules/.pnpm/next@15.0.0-canary.36_react-dom@19.0.0-rc.0_react@19.0.0-rc.0/node_modules/next/dist/build/webpack/loaders/next-app-loader.js?name=app%2Fapi%2Fcsp-report%2Froute&page=%2Fapi%2Fcsp-report%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fcsp-report%2Froute.ts&appDir=%2FUsers%2Fhaydenfarquhar%2FProjects%2Ftorvus-console%2Fapps%2Fconsole%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fhaydenfarquhar%2FProjects%2Ftorvus-console%2Fapps%2Fconsole&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();