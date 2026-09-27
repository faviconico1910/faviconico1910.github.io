# Regular Expression

| Operator | Description                                                                                 |
| -------- | ------------------------------------------------------------------------------------------- |
| `(a)`    | Groups parts of a regex so they can be processed together.                                  |
| `[a-z]`  | Defines a character class and matches characters within the specified range or set.         |
| `{1,10}` | Defines a quantifier that specifies how many times the previous pattern should be repeated. |
| `\|`     | OR operator; matches when either of the two expressions matches.                            |
| `.*`     | Matches any character zero or more times, allowing arbitrary text between patterns.         |

For example, if we want to search for all lines beginning with `Password` and containing `yes`, we use this pattern: `"(^Password.*yes)"`

# Change Permissions (chmod)

| Group | Meaning   |
| ----- | --------- |
| u     | Owner     |
| g     | Group     |
| o     | Others    |
| a     | All users |

| Permission | Binary | Octal |
| ---------- | -----: | ----: |
| `---`      |  `000` |   `0` |
| `--x`      |  `001` |   `1` |
| `-w-`      |  `010` |   `2` |
| `-wx`      |  `011` |   `3` |
| `r--`      |  `100` |   `4` |
| `r-x`      |  `101` |   `5` |
| `rw-`      |  `110` |   `6` |
| `rwx`      |  `111` |   `7` |

For example, if we want to change permission to read for all user, we can use above command:

```
chmod a+r <filename> or chmod 444 <filename>
```

# Network Services

## SSH

Secure Shell (SSH) is a network protocol that allows the secure transmission of data and commands over a network.
As penetration testers, we use OpenSSH to securely access remote systems when performing a network audit. To do this, we can use the following command: `ssh hostname@ip`. After that, we type server password and connect.

## NFS

Network File System (NFS) is a network protocol that allows us to store and manage files on remote systems

| Option           | Description                                                                                |
| :--------------- | :----------------------------------------------------------------------------------------- |
| `no_root_squash` | Prevents the root user on the client from being restricted to the rights of a normal user. |
| `root_squash`    | Restricts the rights of the root user on the client to the rights of a normal user.        |

### Create NFS Share

`echo '/home/kalid3m0n/nfs_sharing hostname(rw,sync,no_root_squash)' >> /etc/exports`

### Mount NFS Share

`mount Server:<remote path> <local mountpoint>`

## Backup and Restore

We have several options to back up data on an Ubuntu system: `Rsync, Deja Dup, Duplicity`

- Rsync: fast and secure backups, rsync only transfers the portions of file that have changed => easily dealing with large amounts of data

```
rsync -av /path/to/mydirectory user@backup_server:/path/to/backup/directory
```

- Duplicity: encryption features added
- Deja Dup: offers a graphical interface that makes the backup process straightforward, also has encryption features

# Network Configuration

## Network Access Control

| Option                         | Description                                                                                                               |
| :----------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| `Discretionary Access Control` | This model allows the owner of the resource to set permissions for who can access it.                                     |
| `Mandatory Access Control`     | Permissions are enforced by the operating system, not the owner of the resource, making it more secure but less flexible. |
| `Role-based Access Control`    | Permissions are based on an user's role within an organization                                                            |

## Configuring Network Interfaces

`ifconfig` and `ip` are the most 2 commonly commands used to configure network interfaces. These commands allow users to modify and activate settings for a specific interface, such as eth0.

- Assign an IP address to an interface: `ifconfig <interface> <IP> netmask 255.255.255.0`
- Set the default gateway for a network interface `sudo route add default gw <ip> <interface>`.

- DNS servers are responsible for translating domain names into IP addresses. Proper DNS configuration is crucial for enabling devices to access websites, online services, and other networked resources. We can configure DNS in the `/etc/resolve.conf`, for example, adding Google Public DNS:
