/**
 * DataGrid Error Boundary
 * DataGrid 렌더링 오류를 gracefully handle하는 Error Boundary 컴포넌트
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class DataGridErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('DataGrid Error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 4,
            textAlign: 'center',
            height: '100%',
            minHeight: 200,
          }}
        >
          <ErrorOutlineIcon color="error" sx={{ fontSize: 48, mb: 2 }} />
          <Typography color="error" variant="h6" gutterBottom>
            DataGrid 렌더링 오류
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 500 }}>
            {this.state.error?.message || 'DataGrid를 렌더링하는 중 알 수 없는 오류가 발생했습니다.'}
          </Typography>
          <Button variant="outlined" onClick={this.handleReset}>
            재시도
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
