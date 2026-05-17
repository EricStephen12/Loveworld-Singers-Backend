// Account Linking Service for LoveWorld Singers App
// Links KingsChat accounts with Firebase accounts

import { FirebaseDatabaseService } from './firebase-database';

export interface LinkedAccount {
  odooId: string;
  odooName: string;
  odooEmail: string;
  firebaseUid?: string;
  linkedAt: string;
}

export interface KingsChatLinkResult {
  success: boolean;
  error?: string;
}

export class AccountLinkingService {
    static async isAccountLinked(odooId: string): Promise<boolean> {
    try {
      const users = await FirebaseDatabaseService.getAllUsers();
      return users.some((user: any) => user.odooId === odooId);
    } catch (error) {
 console.error('Error checking account link:', error);
      return false;
    }
  }

    static async isKingsChatLinked(firebaseUid: string): Promise<boolean> {
    try {
      const user = await FirebaseDatabaseService.getUserProfile(firebaseUid);
      return !!(user as any)?.kingsChatId;
    } catch (error) {
 console.error('Error checking KingsChat link:', error);
      return false;
    }
  }

  // Link a KingsChat account to a Firebase user
  static async linkAccount(
    firebaseUid: string,
    odooId: string,
    odooName: string,
    odooEmail: string
  ): Promise<boolean> {
    try {
      await FirebaseDatabaseService.updateUserProfile(firebaseUid, {
        odooId,
        odooName,
        odooEmail,
        linkedAt: new Date().toISOString()
      });
      return true;
    } catch (error) {
 console.error('Error linking account:', error);
      return false;
    }
  }

  // Link KingsChat to Firebase account using access token
  static async linkKingsChatToFirebase(
    firebaseUid: string,
    accessToken: string
  ): Promise<KingsChatLinkResult> {
    try {
      // Fetch KingsChat user info using the access token
      const response = await fetch('https://api.kingsch.at/v1/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        return { success: false, error: 'Failed to fetch KingsChat user info' };
      }

      const kingsChatUser = await response.json();

            await FirebaseDatabaseService.updateUserProfile(firebaseUid, {
        kingsChatId: kingsChatUser.id,
        kingsChatUsername: kingsChatUser.username || '',
        kingsChatName: kingsChatUser.name || kingsChatUser.displayName || '',
        kingsChatLinkedAt: new Date().toISOString()
      });

      return { success: true };
    } catch (error) {
 console.error('Error linking KingsChat to Firebase:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to link KingsChat account' 
      };
    }
  }

  // Unlink KingsChat from Firebase account
  static async unlinkKingsChatFromFirebase(firebaseUid: string): Promise<KingsChatLinkResult> {
    try {
      await FirebaseDatabaseService.updateUserProfile(firebaseUid, {
        kingsChatId: null,
        kingsChatUsername: null,
        kingsChatName: null,
        kingsChatLinkedAt: null
      });

      return { success: true };
    } catch (error) {
 console.error('Error unlinking KingsChat from Firebase:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to unlink KingsChat account' 
      };
    }
  }

  // Get linked account info for a Firebase user
  static async getLinkedAccount(firebaseUid: string): Promise<LinkedAccount | null> {
    try {
      const user = await FirebaseDatabaseService.getUserProfile(firebaseUid) as any;
      if (user?.odooId) {
        return {
          odooId: user.odooId,
          odooName: user.odooName || '',
          odooEmail: user.odooEmail || '',
          firebaseUid,
          linkedAt: user.linkedAt || ''
        };
      }
      return null;
    } catch (error) {
 console.error('Error getting linked account:', error);
      return null;
    }
  }

  // Unlink a KingsChat account from a Firebase user
  static async unlinkAccount(firebaseUid: string): Promise<boolean> {
    try {
      await FirebaseDatabaseService.updateUserProfile(firebaseUid, {
        odooId: null,
        odooName: null,
        odooEmail: null,
        linkedAt: null
      });
      return true;
    } catch (error) {
 console.error('Error unlinking account:', error);
      return false;
    }
  }
}
