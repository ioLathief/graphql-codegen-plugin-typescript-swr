"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SWRVisitor = exports.validate = exports.plugin = void 0;
const path_1 = require("path");
const graphql_1 = require("graphql");
const visitor_1 = require("./visitor");
Object.defineProperty(exports, "SWRVisitor", { enumerable: true, get: function () { return visitor_1.SWRVisitor; } });
const plugin = (schema, documents, config) => {
    const allAst = graphql_1.concatAST(documents.map((v) => v.document));
    const allFragments = [
        ...allAst.definitions.filter((d) => d.kind === graphql_1.Kind.FRAGMENT_DEFINITION).map((fragmentDef) => ({
            node: fragmentDef,
            name: fragmentDef.name.value,
            onType: fragmentDef.typeCondition.name.value,
            isExternal: false,
        })),
        ...(config.externalFragments || []),
    ];
    const visitor = new visitor_1.SWRVisitor(schema, allFragments, config);
    graphql_1.visit(allAst, { leave: visitor });
    return {
        prepend: visitor.getImports(),
        content: visitor.sdkContent,
    };
};
exports.plugin = plugin;
const validate = async (_schema, _documents, _config, outputFile) => {
    if (path_1.extname(outputFile) !== '.ts') {
        throw new Error(`Plugin "typescript-swr" requires extension to be ".ts"!`);
    }
};
exports.validate = validate;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zcmMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsK0JBQThCO0FBUTlCLHFDQU1nQjtBQUdoQix1Q0FBc0M7QUF3QzdCLDJGQXhDQSxvQkFBVSxPQXdDQTtBQXRDWixNQUFNLE1BQU0sR0FBdUMsQ0FDeEQsTUFBcUIsRUFDckIsU0FBK0IsRUFDL0IsTUFBMEIsRUFDMUIsRUFBRTtJQUNGLE1BQU0sTUFBTSxHQUFHLG1CQUFTLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUE7SUFFMUQsTUFBTSxZQUFZLEdBQXFCO1FBQ3JDLEdBQUksTUFBTSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQzNCLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLGNBQUksQ0FBQyxtQkFBbUIsQ0FDZCxDQUFDLEdBQUcsQ0FBQyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUNuRCxJQUFJLEVBQUUsV0FBVztZQUNqQixJQUFJLEVBQUUsV0FBVyxDQUFDLElBQUksQ0FBQyxLQUFLO1lBQzVCLE1BQU0sRUFBRSxXQUFXLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLO1lBQzVDLFVBQVUsRUFBRSxLQUFLO1NBQ2xCLENBQUMsQ0FBQztRQUNILEdBQUcsQ0FBQyxNQUFNLENBQUMsaUJBQWlCLElBQUksRUFBRSxDQUFDO0tBQ3BDLENBQUE7SUFFRCxNQUFNLE9BQU8sR0FBRyxJQUFJLG9CQUFVLENBQUMsTUFBTSxFQUFFLFlBQVksRUFBRSxNQUFNLENBQUMsQ0FBQTtJQUM1RCxlQUFLLENBQUMsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxDQUFDLENBQUE7SUFDakMsT0FBTztRQUNMLE9BQU8sRUFBRSxPQUFPLENBQUMsVUFBVSxFQUFFO1FBQzdCLE9BQU8sRUFBRSxPQUFPLENBQUMsVUFBVTtLQUM1QixDQUFBO0FBQ0gsQ0FBQyxDQUFBO0FBekJZLFFBQUEsTUFBTSxVQXlCbEI7QUFFTSxNQUFNLFFBQVEsR0FBMEIsS0FBSyxFQUNsRCxPQUFzQixFQUN0QixVQUFnQyxFQUNoQyxPQUEyQixFQUMzQixVQUFrQixFQUNsQixFQUFFO0lBQ0YsSUFBSSxjQUFPLENBQUMsVUFBVSxDQUFDLEtBQUssS0FBSyxFQUFFO1FBQ2pDLE1BQU0sSUFBSSxLQUFLLENBQUMseURBQXlELENBQUMsQ0FBQTtLQUMzRTtBQUNILENBQUMsQ0FBQTtBQVRZLFFBQUEsUUFBUSxZQVNwQiJ9