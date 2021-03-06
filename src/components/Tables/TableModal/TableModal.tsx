import { useEffect, useState } from "react";
import { FloatingLabel, Form, Modal, Button } from "react-bootstrap";
import backend from "../../../backend/backend";
import { useAppDispatch, useAppSelector } from "../../../redux/app/hooks";
import { fetchShopList } from "../../../redux/slices/shopSlice";
import { ITable } from "../../../typings/shop";
import "./TableModal.css";

interface TableModalProps {
  shopId: string;
  tableId: string;
  show: boolean;
  handleClose: () => void;
}

const TableModal = ({
  shopId,
  tableId,
  show,
  handleClose,
}: TableModalProps) => {
  const shop = useAppSelector((state) =>
    state.shops.data.find((shop) => shop._id === shopId)
  );
  const selectedTable = shop?.tables.find((table) => table._id === tableId);

  const [table, setTable] = useState<ITable>({
    _id: "",
    name: "",
    Qr_Url: "",
  });

  useEffect(() => {
    setTable({
      _id: selectedTable ? selectedTable._id : "",
      name: selectedTable ? selectedTable.name : "",
      Qr_Url: selectedTable ? selectedTable.Qr_Url : "",
    });
  }, [selectedTable]);

  const dispatch = useAppDispatch();

  const createTable = async () => {
    const newTable = {
      name: table.name,
    };

    const created = await backend.post(`/shops/${shopId}/tables`, newTable);
    console.log("createdTable: ", created); //<========================================== LOG

    dispatch(fetchShopList());
    handleClose();
  };

  const updateTable = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const updated = await backend.put(
      `/shops/${shopId}/tables/${table._id}`,
      table
    );
    console.log("updatedTable: ", updated); //<========================================== LOG

    dispatch(fetchShopList());
    handleClose();
  };

  const deleteTable = async () => {
    const deleted = await backend.delete(
      `/shops/${shopId}/tables/${table._id}`
    );
    console.log("deletedTable: ", deleted); //<========================================== LOG

    dispatch(fetchShopList());
    handleClose();
  };

  return (
    <>
      <Modal className="ShopModal" show={show} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Table</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={(e) => updateTable(e)}>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <FloatingLabel controlId="floatingInput" label="Name">
                <Form.Control
                  placeholder="Name"
                  value={table.name}
                  onChange={(e) => setTable({ ...table, name: e.target.value })}
                />
              </FloatingLabel>
            </Form.Group>
            {tableId !== "new" ? (
              <Form.Group className="d-flex justify-content-between">
                <Button
                  variant="outline-danger"
                  className="my-2"
                  onClick={deleteTable}
                >
                  Delete Table
                </Button>
                <Button className="my-2" variant="primary" type="submit">
                  Save Changes
                </Button>
              </Form.Group>
            ) : (
              <Form.Group className="d-flex justify-content-end">
                <Button
                  className="my-2"
                  variant="primary"
                  onClick={createTable}
                >
                  Create Table
                </Button>
              </Form.Group>
            )}
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default TableModal;
