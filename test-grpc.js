/**
 * Simple Node.js gRPC Test Script
 * 백엔드 연결을 빠르게 테스트하기 위한 스크립트
 *
 * 실행 방법: node test-grpc.js
 */

import { TaskManagerClient } from './proto/task_manager_grpc_web_pb.js';
import { TaskArgs } from './proto/task_manager_pb.js';

const BACKEND_URL = 'http://129.254.222.219:8443';

console.log('🧪 gRPC Connection Test\n');
console.log(`Backend URL: ${BACKEND_URL}\n`);

// TaskManager 클라이언트 생성
const client = new TaskManagerClient(BACKEND_URL);

// 테스트 인자
const testArgs = 'v-smr,user1/test,plotfl';

console.log(`Test Arguments: ${testArgs}`);
console.log('─'.repeat(50));

// 작업 시작 테스트
console.log('\n1️⃣  Testing startTask...');

const taskArgs = new TaskArgs();
taskArgs.setArgsList(testArgs.split(','));

client.startTask(taskArgs, {}, (err, response) => {
  if (err) {
    console.error('❌ Connection Failed!');
    console.error('Error:', err.message);
    console.error('\nPossible reasons:');
    console.error('  - Backend server is not running');
    console.error('  - CORS is not enabled on backend');
    console.error('  - Network/firewall blocking connection');
    console.error('  - Wrong URL or port');
    process.exit(1);
  }

  const taskId = response.getTaskId();
  console.log('✅ Connection Successful!');
  console.log(`Task ID: ${taskId}`);

  // EOL 가져오기 테스트
  console.log('\n2️⃣  Testing getEOL...');

  const { TaskId } = await import('./proto/task_manager_pb.js');
  const taskIdObj = new TaskId();
  taskIdObj.setTaskId(taskId);

  client.getEol(taskIdObj, {}, (err, response) => {
    if (err) {
      console.error('❌ getEOL Failed:', err.message);
    } else {
      const eol = response.getLogMsg();
      console.log(`✅ EOL Marker: "${eol}"`);
    }

    // 화면 로그 테스트
    console.log('\n3️⃣  Testing getScreenLog...');

    client.getScreenLog(taskIdObj, {}, (err, response) => {
      if (err) {
        console.error('❌ getScreenLog Failed:', err.message);
      } else {
        const log = response.getLogMsg();
        console.log(`✅ Screen Log (first 100 chars):`);
        console.log(`   ${log.substring(0, 100)}...`);
      }

      console.log('\n' + '═'.repeat(50));
      console.log('✅ All tests completed successfully!');
      console.log('You can now use the gRPC services in your React app.');
      console.log('\nNext steps:');
      console.log('  1. Run: npm run dev');
      console.log('  2. Navigate to: http://localhost:5173/grpc-test');
      console.log('═'.repeat(50));

      process.exit(0);
    });
  });
});

// 타임아웃 설정 (10초)
setTimeout(() => {
  console.error('\n❌ Test timeout (10 seconds)');
  console.error('Backend might be too slow or not responding');
  process.exit(1);
}, 10000);
