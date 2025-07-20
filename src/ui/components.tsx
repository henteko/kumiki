
import { Box, Text, Spacer } from 'ink';
import { Spinner, ProgressBar, Alert, Badge } from '@inkjs/ui';
import * as React from 'react';

interface StatusMessageProps {
  type: 'info' | 'error' | 'success' | 'warning';
  message: string;
  details?: Record<string, unknown>;
}

export const StatusMessage = ({ type, message, details }: StatusMessageProps): React.ReactElement => {
  const typeColors = {
    info: 'blue',
    error: 'red',
    success: 'green',
    warning: 'yellow',
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Badge color={typeColors[type] as any}>{type.toUpperCase()}</Badge>
        <Text> {message}</Text>
      </Box>
      {details && (
        <Box marginLeft={2} flexDirection="column">
          {Object.entries(details).map(([key, value]) => (
            <Text key={key} dimColor>
              {key}: {JSON.stringify(value)}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};

interface ProcessingSceneProps {
  current: number;
  total: number;
  sceneId: string;
  sceneType: string;
}

export const ProcessingScene = ({
  current,
  total,
  sceneId,
  sceneType,
}: ProcessingSceneProps): React.ReactElement => {
  return (
    <Box>
      <Spinner />
      <Text> Processing scene {current}/{total}: </Text>
      <Badge color="blue">{sceneType}</Badge>
      <Text> {sceneId}</Text>
    </Box>
  );
};

interface GenerateProgressProps {
  progress: number;
  phase: 'rendering' | 'encoding' | 'complete';
}

export const GenerateProgress = ({ progress, phase }: GenerateProgressProps): React.ReactElement => {
  const phaseMessages = {
    rendering: 'Rendering scenes',
    encoding: 'Encoding video',
    complete: 'Complete',
  };

  return (
    <Box flexDirection="column">
      <Box>
        <Text>{phaseMessages[phase]}</Text>
        <Spacer />
        <Text>{Math.round(progress)}%</Text>
      </Box>
      <Box marginTop={1}>
        <ProgressBar value={progress} />
      </Box>
    </Box>
  );
};

interface ValidationResultProps {
  valid: boolean;
  errors?: Array<{ path: string; message: string }>;
}

export const ValidationResult = ({ valid, errors }: ValidationResultProps): React.ReactElement => {
  if (valid) {
    return <Alert variant="success">{`✅ Validation successful!`}</Alert>;
  }

  return (
    <Box flexDirection="column">
      <Alert variant="error">{`❌ Validation failed!`}</Alert>
      {errors && errors.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          {errors.map((error, index) => (
            <Text key={index}>
              <Text color="red">  • </Text>
              <Text dimColor>{error.path}: </Text>
              <Text>{error.message}</Text>
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};

interface PreviewSummaryProps {
  results: Array<{ sceneId: string; outputPath: string }>;
  outputDir: string;
}

export const PreviewSummary = ({ results, outputDir }: PreviewSummaryProps): React.ReactElement => {
  return (
    <Box flexDirection="column">
      <Alert variant="success">{`🎉 Preview generation completed!`}</Alert>
      <Box marginTop={1}>
        <Text>Output directory: {outputDir}</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold>Generated previews:</Text>
        {results.map(({ sceneId, outputPath }) => (
          <Text key={sceneId}>
            <Text color="green">  • </Text>
            <Text>{sceneId}: </Text>
            <Text dimColor>{outputPath}</Text>
          </Text>
        ))}
      </Box>
    </Box>
  );
};