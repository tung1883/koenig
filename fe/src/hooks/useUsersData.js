import { useCallback, useEffect, useState } from "react";
import { usersApi } from "../api";

function useUsersData(me) {
  const [users, setUsers] = useState([]);
  const [userMap, setUserMap] = useState({});

  const refreshUsers = useCallback(async () => {
    try {
      const list = await usersApi.getUsers();
      const nextUsers = Array.isArray(list) ? list : [];
      setUsers(nextUsers);
      const map = {};
      nextUsers.forEach((u) => {
        map[Number(u.userID)] = u.displayName || u.user;
      });
      setUserMap(map);
    } catch (error) {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!me) return undefined;
    refreshUsers();
  }, [me, refreshUsers]);

  return { users, userMap, setUsers, refreshUsers };
}

export default useUsersData;
