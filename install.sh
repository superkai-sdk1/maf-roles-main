#!/bin/bash

# Variables
GIT_REPO_URL="https://github.com/KaiMichael/maf-roles-main.git"
APP_DIR_NAME="maf-roles-main"
APP_DIR="/root/$APP_DIR_NAME"
MAIN_SCRIPT="index.js"
APP_NAME="maf-roles"
NODE_VERSION="20" # Using a modern, stable LTS version

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

print_message "Starting installation of $APP_NAME"

# Update package list
apt-get update

# Install git and curl if they are not installed
print_message "Installing git and curl..."
apt-get install -y git curl

# --- NVM and Node.js Installation ---
print_message "Installing Node.js v$NODE_VERSION using NVM (Node Version Manager)"

# Set the NVM directory and ensure it's sourced for this script
export NVM_DIR="/root/.nvm"
# Download and run the nvm installation script
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Source nvm script to make it available in the current shell session
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Add NVM to bashrc to make it available in new shells
echo \'\'\'
export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
\'\'\' >> /root/.bashrc


# Verify nvm installation
if ! command -v nvm &> /dev/null
then
    # Source again just in case
    source /root/.bashrc
    if ! command -v nvm &> /dev/null
    then
        print_message "NVM installation failed. Exiting."
        exit 1
    fi
fi

# Install the specified version of Node.js
print_message "Installing Node.js v$NODE_VERSION..."
nvm install $NODE_VERSION

# Set the installed version as the default
nvm alias default $NODE_VERSION
nvm use default

# Verify Node.js and npm installation
print_message "Node.js and npm versions:"
node -v
npm -v

# --- Application Setup ---
print_message "Cloning application from Git repository"
# Remove existing directory if it exists
if [ -d "$APP_DIR" ]; then
    rm -rf "$APP_DIR"
fi
cd /root
git clone "$GIT_REPO_URL"
cd "$APP_DIR"

print_message "Installing application dependencies using npm"
# Use the npm from nvm's path
/root/.nvm/versions/node/$(nvm current)/bin/npm install

# --- PM2 Setup ---
print_message "Installing/updating PM2"
# Use the npm from nvm's path to install pm2 globally for the nvm-managed node version
/root/.nvm/versions/node/$(nvm current)/bin/npm install pm2 -g

# Define the path to the nvm-installed pm2
PM2_PATH="/root/.nvm/versions/node/$(nvm current)/bin/pm2"

print_message "Stopping any existing PM2 process for this app"
$PM2_PATH delete "$APP_NAME" || true

print_message "Starting application with PM2"
cd "$APP_DIR"
$PM2_PATH start "$MAIN_SCRIPT" --name "$APP_NAME"

print_message "Setting up PM2 to start on boot"
# The 'env' part ensures the command runs with the correct user environment
$PM2_PATH startup systemd -u root --hp /root

# Save the current process list to be respawned on reboot
$PM2_PATH save

print_message "Installation complete. $APP_NAME is running and will restart on boot."
print_message "To check status, run: $PM2_PATH status"
