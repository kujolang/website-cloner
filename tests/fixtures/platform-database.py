"""Isolated Unix-socket MariaDB lifecycle, never the user's default database."""
import os,pathlib,subprocess,time

def start(root):
 root=pathlib.Path(root);root.mkdir(parents=True,exist_ok=True);root.chmod(0o700)
 data=root/'mariadb';socket=root/'mysql.sock'
 if len(str(socket).encode())>100:raise RuntimeError('Use a shorter fixture runtime path for the database socket')
 if not (data/'mysql').exists():
  result=subprocess.run(['mariadb-install-db','--no-defaults','--datadir='+str(data),'--auth-root-authentication-method=normal','--skip-test-db'],capture_output=True,text=True)
  (root/'database-install.log').write_text(result.stdout+result.stderr)
  if result.returncode:raise RuntimeError('Fixture database initialization failed')
 process=subprocess.Popen(['mysqld','--no-defaults','--datadir='+str(data),'--socket='+str(socket),'--pid-file='+str(root/'mysql.pid'),'--skip-networking','--log-error='+str(root/'database.log')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 for _ in range(100):
  if process.poll() is not None:raise RuntimeError('Fixture database stopped; inspect database.log')
  if socket.exists():
   result=subprocess.run(['mariadb','--no-defaults','--socket='+str(socket),'-u','root','-e','CREATE DATABASE IF NOT EXISTS fixture;'],capture_output=True)
   if not result.returncode:return process
  time.sleep(.1)
 process.terminate();process.wait();raise RuntimeError('Fixture database did not become ready')
