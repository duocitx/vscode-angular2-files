import * as fs from 'fs';
import * as path from 'path';
import * as es6Renderer from 'express-es6-template-engine';
import { IConfig } from './models/config';
import { toCamelCase, toUpperCase } from './formatting';
import { promisify } from './promisify';
import { TemplateType } from './enums/template-type';
import { workspace } from 'vscode';

const fsReaddir = promisify(fs.readdir);
const fsReadFile = promisify(fs.readFile);
const TEMPLATES_FOLDER = 'templates';
const TEMPLATE_ARGUMENTS = 'inputName, upperName, interfacePrefix, cmpPrefix, dirPrefix, cmpSelector, dirSelector, componentViewEncapsulation, componentChangeDetection, componentInlineTemplate, componentInlineStyle, defaultsStyleExt, routing, routingScope, importCommonModule, params';

export class FileContents {
  private templatesMap: Map<string, Function>;

  constructor() {
    this.templatesMap = new Map<string, Function>();
  }

  async loadTemplates(config: IConfig) {
    const map = new Map();

    const templatesMap = await this.getTemplates(__dirname);

    if (config.defaults.templates && config.defaults.templates.path) {
      const [ws] = workspace.workspaceFolders;
      const workspaceFolder = ws && ws.uri && ws.uri.path;
      const fixWorkspaceFolder = workspaceFolder.substring(1);
      
      const projectTemplatesMap = await this.getTemplates(path.join(fixWorkspaceFolder, config.defaults.templates.path));
      for (const [key, value] of projectTemplatesMap.entries()) {
        templatesMap.set(key, value);
      }
    }

    for (const [key, value] of templatesMap.entries()) {
      const compiled = es6Renderer(value, TEMPLATE_ARGUMENTS);
      this.templatesMap.set(key, compiled);
    }
  }

  private async getTemplates(dir: string): Promise<Map<string, string>> {
    const templatesPath = path.join(dir, TEMPLATES_FOLDER);
    const templatesFiles: string[] = await fsReaddir(templatesPath, 'utf-8');
    const templatesFilesPromises = templatesFiles.map(t => fsReadFile(path.join(dir, TEMPLATES_FOLDER, t), 'utf8').then(data => [t, data]));
    const templates = await Promise.all(templatesFilesPromises);

    return new Map(templates.map(x => x as [string, string]));
  }

  public getTemplateContent(template: TemplateType, config: IConfig, inputName: string, params: string[] = []) {
    const templateName: string = template;
    const [app] = config.apps;
    const cmpPrefix = config.defaults.component.prefix || app.prefix;
    const dirPrefix = config.defaults.directive.prefix || app.prefix;
    const cmpSelector = config.defaults.component.selector || `${cmpPrefix}-${inputName}`;
    const dirSelector = config.defaults.directive.selector || `${dirPrefix}${toUpperCase(inputName)}`;
    const styleExt = config.defaults.component.styleext || config.defaults.styleExt;
    const routingScope = config.defaults.module.routingScope || 'Child';
    const importCommonModule = config.defaults.module.commonModule;
    const routing = config.defaults.module.routing || false;

    const args = [inputName,
      toUpperCase(inputName),
      config.defaults.interface.prefix,
      cmpPrefix,
      dirPrefix,
      cmpSelector,
      dirSelector,
      config.defaults.component.viewEncapsulation,
      config.defaults.component.changeDetection,
      config.defaults.component.inlineTemplate,
      config.defaults.component.inlineStyle,
      styleExt,
      routing,
      routingScope,
      importCommonModule,
      params];

    return (this.templatesMap.has(templateName)) ? this.templatesMap.get(templateName)(...args) : '';
  }
}
