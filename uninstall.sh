#!/bin/bash

# Variables
APP_NAME="maf-roles"
APP_DIR_NAME="maf-roles-main"
APP_DIR="/root/$APP_DIR_NAME"

# Function to print messages
print_message() {
    echo "========================================="
    echo "$1"
    echo "========================================="
}

# Ensure script is run as root
if [ "$(id -u)" -ne 0 ]; then
  print_message "This script must be run as root. Please use sudo."
  exit 1
fi

print_message "Starting uninstallation of $APP_NAME"

# --- PM2 Removal ---
print_message "Locating and using NVM-installed PM2"

# Set the NVM directory to find the correct pm2
export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Check if nvm is sourced and node is available
if ! command -v node &> /dev/null
then
    print_message "Could not find Node.js via NVM. Uninstallation might be partial."
    # As a fallback, try to find pm2 in a common global path if nvm fails
    PM2_PATH=$(which pm2)
else
    # Define the path to the nvm-installed pm2
    PM2_PATH="/root/.nvm/versions/node/$(nvm current)/bin/pm2"
fi


if [ -z "$PM2_PATH" ] || ! [ -x "$PM2_PATH" ]; then
    print_message "PM2 command not found. It might already be uninstalled or was not installed correctly."
else
    print_message "Stopping PM2 process: $APP_NAME"
    $PM2_PATH delete "$APP_NAME" || echo "PM2 process '$APP_NAME' not found or already stopped."

    print_message "Removing PM2 startup script"
    $PM2_PATH unstartup systemd || echo "PM2 startup script not found or already removed."

    print_message "Saving empty process list"
    $PM2_PATH save --force
fi


# --- Application Files Removal ---
print_message "Removing application directory: $APP_DIR"
if [ -d "$APP_DIR" ]; then
    rm -rf "$APP_DIR"
    echo "Application directory removed."
else
    echo "Application directory not found."
fi

# --- Final Cleanup ---
# We are NOT uninstalling NVM, Node.js, or PM2 itself,
# as they are part of the environment setup and might be used by other apps.
# We are also not removing old system nodejs packages to avoid apt/dpkg issues.

print_message "Uninstallation complete."
print_message "NVM, Node.js, and PM2 have NOT been removed from the system."
