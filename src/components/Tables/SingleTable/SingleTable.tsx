import QRCodeStyling from "qr-code-styling"
import { createRef, useEffect, useRef, useState } from "react"
import { Card, Button } from "react-bootstrap"
import { GrEdit } from "react-icons/gr"
import { useAppSelector } from "../../../redux/app/hooks"
import TableModal from "../TableModal/TableModal"
import "./SingleTable.css"

interface TableProps {
    tableId: string 
    shopId: string
}

const SingleTable = ({tableId, shopId}: TableProps) => {

    const shop = useAppSelector(state => state.shops.data.find(shop => shop._id === shopId))
    const table = shop?.tables.find(table => table._id === tableId)

    const defaultCover = `https://nayemdevs.com/wp-content/uploads/2020/03/default-product-image.png`

    const qrCode = new QRCodeStyling(
        {
            width: 250,
            height: 250,
            image: shop?.cover !== defaultCover ? shop?.cover : "",
            dotsOptions: {
                color: "#4267b2",
                type: "rounded"
            },
            imageOptions: {
                crossOrigin: "anonymous",
                margin: 2
            }
        }
    )
    const qrRef = createRef<any>()

    useEffect(() => {
        qrCode.append(qrRef.current) 
      }, []);

    qrCode.update({data: table?.Qr_Url})


    const [show, setShow] = useState(false);
    const handleClose = () => setShow(false);
    const handleShow = () => setShow(true);

    return(
        <>
        <div className="SingleTable">
            <Card>
                <Card.Title className="mt-3">{table?.name}</Card.Title>
                {/* <Card.Body>{table?.Qr_Url}</Card.Body> */}
                <div ref={qrRef}/>
                {/* <Button onClick={handleShow} >Edit Table</Button> */}
                <Button size={"lg"} onClick={handleShow}>
                        <GrEdit/>
                    </Button>
            </Card>
            <TableModal shopId={shopId} show={show} handleClose={handleClose} tableId={tableId}/>
            </div>
        </>
    )
} 

export default SingleTable