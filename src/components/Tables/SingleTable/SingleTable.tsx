import QRCodeStyling from "qr-code-styling";
import { useEffect, useRef, useState } from "react";
import { Card, Button } from "react-bootstrap";
import { GrEdit } from "react-icons/gr";
import { useAppSelector } from "../../../redux/app/hooks";
import placeholder from "../../../assets/placeholder.svg";
import TableModal from "../TableModal/TableModal";
import "./SingleTable.css";

interface TableProps {
  tableId: string;
  shopId: string;
}

const SingleTable = ({ tableId, shopId }: TableProps) => {
  const shop = useAppSelector((state) =>
    state.shops.data.find((shop) => shop._id === shopId)
  );
  const table = shop?.tables.find((table) => table._id === tableId);

  const defaultCover = placeholder;

  const qrCode = new QRCodeStyling({
    width: 250,
    height: 250,
    image: shop?.cover !== defaultCover ? shop?.cover : "",
    dotsOptions: {
      // The brand hue (8.2deg, matching the logo's 8.4deg) darkened for scannability.
      // NOT $primary itself: the coral is #FF5F45, whose red channel is 255 — identical
      // to the white background — so in the red band the modules vanish entirely. That
      // matters because these get printed and stuck on tables, where a red-light laser
      // or IR reader would see a blank square. Coral also sits at luma 140/255, right on
      // the binarisation midpoint, and only 3.01:1 against white. This is 10.16:1 with a
      // red-channel delta of 133, so it survives print, dim rooms and odd angles while
      // still reading as the brand rather than the generic black.
      color: "#7A2214",
      type: "rounded",
    },
    imageOptions: {
      crossOrigin: "anonymous",
      margin: 5,
    },
  });
  const qrRef = useRef<HTMLDivElement>(null);

  // Must append once on mount only; qrCode is a new QRCodeStyling instance
  // every render, so listing it here would re-append the canvas every render.
  useEffect(() => {
    qrCode.append(qrRef.current ?? undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  qrCode.update({ data: table?.Qr_Url });

  const [show, setShow] = useState(false);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  return (
    <>
      <div className="SingleTable text-center">
        <Card>
          <Card.Title className="mt-3">{table?.name}</Card.Title>
          <div ref={qrRef} />
          <Button size={"lg"} className="d-print-none" onClick={handleShow}>
            <GrEdit />
          </Button>
        </Card>
        <TableModal
          shopId={shopId}
          show={show}
          handleClose={handleClose}
          tableId={tableId}
        />
      </div>
    </>
  );
};

export default SingleTable;
