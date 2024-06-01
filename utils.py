import sys


def get_port(port_windows, port_linux):
  port = 'dummyPort'
  if sys.platform.startswith('win'):
    print("Windows")
    return port_windows
  else:
    print("Linux")
    return port_linux

    