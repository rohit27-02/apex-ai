export type AgentTemplate = 'success_criteria' | 'planning' | 'execution' | 'validation' | 'other';

export interface AgentTemplateConfig {
  label: string;
  description: string;
  defaults: {
    name: string;
    model: string;
    instructions: string;
    tools: string[];
  };
}

export const AGENT_TEMPLATES: Record<AgentTemplate, AgentTemplateConfig> = {
  success_criteria: {
    label: 'Success Criteria',
    description: 'Defines measurable completion criteria for the task',
    defaults: {
      name: 'Success Criteria Agent',
      model: '',
      instructions:
        'Convert the engineering objective into measurable completion criteria. Analyze the codebase structure and project conventions to generate actionable, testable criteria.',
      tools: ['read_file', 'list_files'],
    },
  },
  planning: {
    label: 'Planning',
    description: 'Creates implementation plans with file-level detail',
    defaults: {
      name: 'Planning Agent',
      model: '',
      instructions:
        'Create a concrete implementation plan naming real files and modules. Consider existing code patterns, dependencies, and testing requirements.',
      tools: ['read_file', 'list_files', 'search'],
    },
  },
  execution: {
    label: 'Execution',
    description: 'Implements changes according to the plan',
    defaults: {
      name: 'Execution Agent',
      model: '',
      instructions:
        'Implement the changes according to the plan. Follow existing code patterns and conventions. Write clean, well-structured code.',
      tools: ['read_file', 'write_file', 'edit_file', 'run_command', 'search'],
    },
  },
  validation: {
    label: 'Validation',
    description: 'Runs validation checks (build, test, lint)',
    defaults: {
      name: 'Validation Agent',
      model: '',
      instructions:
        'Validate that all criteria are met. Run build, test, lint, and type-check commands. Report detailed results.',
      tools: ['run_command', 'read_file', 'search'],
    },
  },
  other: {
    label: 'Custom',
    description: 'Custom agent with empty defaults',
    defaults: {
      name: 'Custom Agent',
      model: '',
      instructions: '',
      tools: [],
    },
  },
};

export const AGENT_TEMPLATE_OPTIONS = Object.entries(AGENT_TEMPLATES).map(
  ([key, config]) => ({
    value: key as AgentTemplate,
    label: config.label,
    description: config.description,
  }),
);
