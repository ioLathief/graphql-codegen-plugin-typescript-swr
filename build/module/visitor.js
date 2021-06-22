import { ClientSideBaseVisitor, indentMultiline, } from '@graphql-codegen/visitor-plugin-common';
import autoBind from 'auto-bind';
import { Kind } from 'graphql';
import glob from 'micromatch';
import { pascalCase } from 'pascal-case';
const composeQueryHandler = (operation, config) => {
    const codes = [];
    const { node } = operation;
    const optionalVariables = !node.variableDefinitions ||
        node.variableDefinitions.length === 0 ||
        node.variableDefinitions.every((v) => v.type.kind !== Kind.NON_NULL_TYPE || v.defaultValue)
        ? '?'
        : '';
    const name = node.name.value;
    const pascalName = pascalCase(node.name.value);
    const responseType = config.rawRequest
        ? `SWRRawResponse<${operation.operationResultType}>`
        : operation.operationResultType;
    const variablesType = operation.operationVariablesTypes;
    codes.push(`use${pascalName}(${config.autogenKey ? '' : 'key: SWRKeyInterface, '}variables${optionalVariables}: ${variablesType}, config?: SWRConfigInterface<${responseType}, ClientError>) {
  return useSWR<${responseType}, ClientError>(${config.autogenKey
        ? `genKey<${variablesType}>('${pascalName}', variables)`
        : 'key'}, () => sdk.${name}(variables), config);
}`);
    if (config.infinite) {
        codes.push(`use${pascalName}Infinite(${config.autogenKey ? '' : 'id: string, '}getKey: ${config.typesPrefix}SWRInfiniteKeyLoader${config.typesSuffix}<${responseType}, ${variablesType}>, variables${optionalVariables}: ${variablesType}, config?: SWRInfiniteConfigInterface<${responseType}, ClientError>) {
  return useSWRInfinite<${responseType}, ClientError>(
    utilsForInfinite.generateGetKey<${responseType}, ${variablesType}>(${config.autogenKey
            ? `genKey<${variablesType}>('${pascalName}', variables)`
            : 'id'}, getKey),
    utilsForInfinite.generateFetcher<${responseType}, ${variablesType}>(sdk.${name}, variables),
    config);
}`);
    }
    return codes;
};
export class SWRVisitor extends ClientSideBaseVisitor {
    constructor(schema, fragments, rawConfig) {
        super(schema, fragments, rawConfig, {
            excludeQueries: rawConfig.excludeQueries || null,
            useSWRInfinite: rawConfig.useSWRInfinite || null,
            autogenSWRKey: rawConfig.autogenSWRKey || false,
        });
        this._operationsToInclude = [];
        this._enabledInfinite = false;
        this._enabledInfinite =
            (this.config.useSWRInfinite &&
                typeof this.config.useSWRInfinite === 'string') ||
                (Array.isArray(this.config.useSWRInfinite) &&
                    this.config.useSWRInfinite.length > 0);
        autoBind(this);
        const typeImport = this.config.useTypeImports ? 'import type' : 'import';
        this._additionalImports.push(`${typeImport} { ClientError } from 'graphql-request/dist/types';`);
        if (this.config.useTypeImports) {
            if (this._enabledInfinite) {
                this._additionalImports.push(`import type { ConfigInterface as SWRConfigInterface, keyInterface as SWRKeyInterface, SWRInfiniteConfigInterface } from 'swr';`);
                this._additionalImports.push(`import useSWR, { useSWRInfinite } from 'swr';`);
            }
            else {
                this._additionalImports.push(`import type { ConfigInterface as SWRConfigInterface, keyInterface as SWRKeyInterface } from 'swr';`);
                this._additionalImports.push(`import useSWR from 'swr';`);
            }
        }
        else if (this._enabledInfinite) {
            this._additionalImports.push(`import useSWR, { useSWRInfinite, SWRConfiguration as SWRConfigInterface, Key as SWRKeyInterface, SWRInfiniteConfiguration as SWRInfiniteConfigInterface } from 'swr';`);
        }
        else {
            this._additionalImports.push(`import useSWR, { SWRConfiguration as SWRConfigInterface, Key as SWRKeyInterface } from 'swr';`);
        }
    }
    buildOperation(node, documentVariableName, operationType, operationResultType, operationVariablesTypes) {
        this._operationsToInclude.push({
            node,
            documentVariableName,
            operationType,
            operationResultType,
            operationVariablesTypes,
        });
        return null;
    }
    get sdkContent() {
        const codes = [];
        const { config } = this;
        const disabledexcludeQueries = !config.excludeQueries ||
            (Array.isArray(config.excludeQueries) && !config.excludeQueries.length);
        const allPossibleActions = this._operationsToInclude
            .filter((o) => {
            if (o.operationType !== 'Query') {
                return false;
            }
            if (disabledexcludeQueries) {
                return true;
            }
            return !glob.isMatch(o.node.name.value, config.excludeQueries);
        })
            .map((o) => composeQueryHandler(o, {
            autogenKey: config.autogenSWRKey,
            infinite: this._enabledInfinite &&
                glob.isMatch(o.node.name.value, config.useSWRInfinite),
            rawRequest: config.rawRequest,
            typesPrefix: config.typesPrefix,
            typesSuffix: config.typesSuffix,
        }))
            .reduce((p, c) => p.concat(c), [])
            .map((s) => indentMultiline(s, 2));
        // Add type of SWRRawResponse
        if (config.rawRequest) {
            codes.push(`type SWRRawResponse<Data = any> = { data?: Data | undefined; extensions?: any; headers: Headers; status: number; errors?: GraphQLError[] | undefined; };`);
        }
        // Add type of SWRInfiniteKeyLoader
        if (this._enabledInfinite) {
            codes.push(`export type ${config.typesPrefix}SWRInfiniteKeyLoader${config.typesSuffix}<Data = unknown, Variables = unknown> = (
  index: number,
  previousPageData: Data | null
) => [keyof Variables, Variables[keyof Variables] | null] | null;`);
        }
        // Add getSdkWithHooks function
        codes.push(`export function getSdkWithHooks(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  const sdk = getSdk(client, withWrapper);`);
        // Add the utility for useSWRInfinite
        if (this._enabledInfinite) {
            codes.push(`  const utilsForInfinite = {
    generateGetKey: <Data = unknown, Variables = unknown>(
      id: any,
      getKey: ${config.typesPrefix}SWRInfiniteKeyLoader${config.typesSuffix}<Data, Variables>
    ) => (pageIndex: number, previousData: Data | null) => {
      const key = getKey(pageIndex, previousData)
      return key ? [...key, ...id] : null
    },
    generateFetcher: <Query = unknown, Variables = unknown>(query: (variables: Variables) => Promise<Query>, variables?: Variables) => (
        fieldName: keyof Variables,
        fieldValue: Variables[typeof fieldName]
      ) => query({ ...variables, [fieldName]: fieldValue } as Variables)
  }`);
        }
        // Add the function for auto-generation key for SWR
        if (config.autogenSWRKey) {
            codes.push(`  const genKey = <V extends Record<string, unknown> = Record<string, unknown>>(name: string, object: V = {} as V): SWRKeyInterface => [name, ...Object.keys(object).sort().map(key => object[key])];`);
        }
        // Add return statement for getSdkWithHooks function and close the function
        codes.push(`  return {
    ...sdk,
${allPossibleActions.join(',\n')}
  };
}`);
        // Add type of Sdk
        codes.push(`export type ${config.typesPrefix}SdkWithHooks${config.typesSuffix} = ReturnType<typeof getSdkWithHooks>;`);
        return codes.join('\n');
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidmlzaXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy92aXNpdG9yLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFFSCxxQkFBcUIsRUFDckIsZUFBZSxHQUdsQixNQUFNLHdDQUF3QyxDQUFBO0FBQy9DLE9BQU8sUUFBUSxNQUFNLFdBQVcsQ0FBQTtBQUNoQyxPQUFPLEVBQWdCLElBQUksRUFBMEIsTUFBTSxTQUFTLENBQUE7QUFDcEUsT0FBTyxJQUFJLE1BQU0sWUFBWSxDQUFBO0FBQzdCLE9BQU8sRUFBQyxVQUFVLEVBQUMsTUFBTSxhQUFhLENBQUE7QUEyQnRDLE1BQU0sbUJBQW1CLEdBQUcsQ0FDeEIsU0FBb0IsRUFDcEIsTUFBaUMsRUFDekIsRUFBRTtJQUNWLE1BQU0sS0FBSyxHQUFhLEVBQUUsQ0FBQTtJQUMxQixNQUFNLEVBQUMsSUFBSSxFQUFDLEdBQUcsU0FBUyxDQUFBO0lBQ3hCLE1BQU0saUJBQWlCLEdBQ25CLENBQUMsSUFBSSxDQUFDLG1CQUFtQjtRQUN6QixJQUFJLENBQUMsbUJBQW1CLENBQUMsTUFBTSxLQUFLLENBQUM7UUFDckMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FDMUIsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxDQUFDLFlBQVksQ0FDOUQ7UUFDRyxDQUFDLENBQUMsR0FBRztRQUNMLENBQUMsQ0FBQyxFQUFFLENBQUE7SUFDWixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQTtJQUM1QixNQUFNLFVBQVUsR0FBRyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQTtJQUM5QyxNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsVUFBVTtRQUNsQyxDQUFDLENBQUMsa0JBQWtCLFNBQVMsQ0FBQyxtQkFBbUIs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