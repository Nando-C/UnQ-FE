import { useState } from "react";
import { ListGroup, Button, Table } from "react-bootstrap";
import { useAppSelector } from "../../../redux/app/hooks";
import SingleTable from "../SingleTable/SingleTable";
import TableModal from "../TableModal/TableModal";
import "./TableList.css"

interface ShopMenuProps {
    shopId: string
}

const TableList = ({shopId}:ShopMenuProps) => {

    const shop = useAppSelector(state => state.shops.data.find(shop => shop._id === shopId))
   
    const [show, setShow] = useState(false);
    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    return (
        <>
            <h1>Table List</h1>
            <div className="my-3 text-align-end">
                <Button onClick={handleShow}>Add Table</Button>
            </div>
            <ListGroup className="px-0" variant="flush">
                {shop?.tables.map(table => (
                    <ListGroup.Item className="px-0 menu-item">
                        <SingleTable shopId={shopId} tableId={table._id}/>
                    </ListGroup.Item>
                ))}
            </ListGroup>
            <TableModal shopId={shopId} show={show} handleClose={handleClose} tableId={"new"}/>
        </>
    )
}

export default TableList