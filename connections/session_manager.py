session_ids = {}


def add_session_id(user_id, session_id):
    session_ids[user_id] = session_id


def remove_session_id(user_id):
    if user_id in session_ids:
        del session_ids[user_id]


def get_session_id(user_id):
    return session_ids[user_id]
