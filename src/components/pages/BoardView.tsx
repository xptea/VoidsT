import { useState, useEffect } from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { collection, query, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import List from '../../components/backend/List';
import { v4 as uuidv4 } from 'uuid';
import { useDragDropSystem, CardType, ListType } from '../../lib/DragDropSystem';

interface BoardViewProps {
  boardId: string;
  onTrelloImport?: () => void;
}

const BoardView = ({ boardId, onTrelloImport }: BoardViewProps) => {
  const [lists, setLists] = useState<ListType[]>([]);
  const [board, setBoard] = useState<{ title: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const [isHorizontal] = useState(false);

  useEffect(() => {
    if (!user || !boardId) return;

    const boardRef = doc(db, `users/${user.uid}/boards/${boardId}`);
    const unsubscribeBoard = onSnapshot(boardRef, (doc) => {
      if (doc.exists()) {
        setBoard(doc.data() as { title: string });
      }
    });

    const cardsRef = collection(db, `users/${user.uid}/boards/${boardId}/cards`);
    const q = query(cardsRef);
    
    const unsubscribeCards = onSnapshot(q, (snapshot) => {
      const cardsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ListType[];
      
      setLists(cardsData.sort((a, b) => a.order - b.order));
      setIsLoading(false);
    });

    return () => {
      unsubscribeBoard();
      unsubscribeCards();
    };
  }, [user, boardId]);

  const addList = async () => {
    if (!user || !boardId) return;

    const cardsRef = collection(db, `users/${user.uid}/boards/${boardId}/cards`);
    await addDoc(cardsRef, {
      title: 'New List',
      cards: [],
      order: lists.length
    });
  };

  const deleteList = async (listId: string) => {
    if (!user || !boardId) return;
    const listRef = doc(db, `users/${user.uid}/boards/${boardId}/cards`, listId);
    await deleteDoc(listRef);
  };

  const updateList = async (listId: string, newTitle: string) => {
    if (!user || !boardId) return;
    const listRef = doc(db, `users/${user.uid}/boards/${boardId}/cards`, listId);
    await updateDoc(listRef, { title: newTitle });
  };

  const addCard = async (listId: string) => {
    if (!user || !boardId) return;
    
    const listRef = doc(db, `users/${user.uid}/boards/${boardId}/cards`, listId);
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    const newCard = {
      id: uuidv4(),
      title: 'New Card',
      description: 'Description',
    };

    await updateDoc(listRef, {
      cards: [...(list.cards || []), newCard],
    });
  };

  const updateCard = async (listId: string, cardId: string, updates: Partial<CardType>) => {
    if (!user || !boardId) return;

    const listRef = doc(db, `users/${user.uid}/boards/${boardId}/cards`, listId);
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    const updatedCards = list.cards.map(card => 
      card.id === cardId ? { ...card, ...updates } : card
    );

    await updateDoc(listRef, { cards: updatedCards });
  };

  const deleteCard = async (listId: string, cardId: string) => {
    if (!user || !boardId) return;

    const listRef = doc(db, `users/${user.uid}/boards/${boardId}/cards`, listId);
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    const updatedCards = list.cards.filter(card => card.id !== cardId);
    await updateDoc(listRef, { cards: updatedCards });
  };

  const { onDragEnd } = useDragDropSystem({
    lists,
    setLists,
    userId: user?.uid || '',
    boardId,
  });

  if (isLoading) {
    return (
      <div className="flex-1 bg-[#111111] p-4 flex items-center justify-center">
        <span className="text-[#666666]">Loading board...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#111111] p-4">
      <div className="flex items-center justify-between gap-2 mb-4 px-2">
        <h2 className="text-white font-medium">{board?.title || 'Loading...'}</h2>
        {onTrelloImport && (
          <button
            onClick={addList}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#222222] hover:bg-[#333333] text-[#666666] hover:text-white transition-colors text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Add New Card
          </button>
        )}
      </div>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="all-lists" type="LIST" direction={isHorizontal ? 'horizontal' : 'vertical'}>
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className={`${
                isHorizontal 
                  ? 'flex gap-4 overflow-x-auto pb-4' 
                  : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              } relative`}
              style={{
                minHeight: '100px',
                height: 'calc(100vh - 140px)',
              }}
            >
              {lists.map((list, index) => (
                <List
                  key={list.id}
                  id={list.id}
                  title={list.title}
                  cards={list.cards || []}
                  index={index}
                  onDelete={deleteList}
                  onUpdate={updateList}
                  onAdd={addCard}
                  onUpdateCard={updateCard}
                  onDeleteCard={deleteCard}
                  isHorizontal={isHorizontal}
                />
              ))}
              {provided.placeholder}
              
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>

  );
};

export default BoardView;

