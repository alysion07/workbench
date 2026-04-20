/**
 * App Router
 *
 * React Router를 사용한 라우팅 설정
 * - 공개 라우트: 로그인 페이지
 * - 보호된 라우트: 인증 필요한 페이지들
 *
 * PRJ-001: 프로젝트 선택/생성 페이지가 메인 진입점
 */

import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ProjectPickerPage from './pages/ProjectPickerPage';
import ProjectHomePage from './pages/ProjectHomePage';
import ModelHomePage from './pages/ModelHomePage';
import EditorPage from './pages/EditorPage';
import SimulationPage from './pages/SimulationPage';
import AnalysisPage from './pages/AnalysisPage';
import AccountSettingsPage from './pages/AccountSettingsPage';
import { ComponentViewerDemo } from './components/projectPicker';

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      {/* 공개 라우트 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* 보호된 라우트 - 인증 필요 */}
      {/* PRJ-001: 프로젝트 선택/생성 페이지가 메인 진입점 */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ProjectPickerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <ProjectPickerPage />
          </ProtectedRoute>
        }
      />

      {/* MAIN-001: Project Home Page */}
      <Route
        path="/projects/:projectId"
        element={
          <ProtectedRoute>
            <ProjectHomePage />
          </ProtectedRoute>
        }
      />

      {/* MDH-001: Model Home Page */}
      <Route
        path="/projects/:projectId/models/:modelId"
        element={
          <ProtectedRoute>
            <ModelHomePage />
          </ProtectedRoute>
        }
      />

      {/* Legacy routes - redirect to /projects */}
      <Route path="/home" element={<Navigate to="/projects" replace />} />
      <Route path="/dashboard" element={<Navigate to="/projects" replace />} />
      <Route path="/dashboard/*" element={<Navigate to="/projects" replace />} />
      <Route path="/workspace" element={<Navigate to="/projects" replace />} />

      <Route
        path="/editor"
        element={
          <ProtectedRoute>
            <EditorPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/simulation"
        element={
          <ProtectedRoute>
            <SimulationPage />
          </ProtectedRoute>
        }
      />

      {/* ANA-001: Analysis Page */}
      <Route
        path="/analysis"
        element={
          <ProtectedRoute>
            <AnalysisPage />
          </ProtectedRoute>
        }
      />

      {/* Account Settings Page */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AccountSettingsPage />
          </ProtectedRoute>
        }
      />

      {/* Component Viewer Demo (Dashboard 개편용) */}
      <Route
        path="/component-demo"
        element={
          <ProtectedRoute>
            <ComponentViewerDemo />
          </ProtectedRoute>
        }
      />

      {/* 관리자 라우트 → 계정 설정 페이지로 리다이렉트 */}
      <Route path="/admin" element={<Navigate to="/settings" replace />} />

      {/* 404 - 인증되지 않은 경우 로그인으로, 인증된 경우 홈으로 */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </>
  )
);

const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};

export default AppRouter;
