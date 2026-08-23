import type * as React from 'react';

export type PatternDemoProps = {
  stateId: string;
};

export type PatternStateDefinition = {
  id: string;
  title: string;
  description?: string;
};

export type PatternScreenDefinition = {
  id: string;
  title: string;
  description?: string;
  source: React.ElementType;
  component: React.ComponentType<PatternDemoProps>;
  states?: readonly PatternStateDefinition[];
  defaultState?: string;
};

export type PatternDomain = {
  id: string;
  title: string;
  description: string;
  screens: readonly PatternScreenDefinition[];
};
