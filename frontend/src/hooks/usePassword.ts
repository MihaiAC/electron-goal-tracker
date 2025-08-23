export function usePassword() {
  const savePassword = async (password: string): Promise<void> => {
    try {
      await window.api.savePassword(password);
    } catch (error) {
      console.error("Failed to save password: ", error);
      throw error;
    }
  };

  const getPassword = async (): Promise<string | null> => {
    try {
      const password = await window.api.getPassword();
      return password;
    } catch (error) {
      console.error("Failed to get password: ", error);
      throw error;
    }
  };

  const clearPassword = async (): Promise<void> => {
    try {
      await window.api.clearPassword();
    } catch (error) {
      console.error("Failed to clear password: ", error);
      throw error;
    }
  };

  return {
    savePassword,
    getPassword,
    clearPassword,
  };
}
